/* Sachi V8 — keeps the original V7 localStorage key and stable word IDs. */
(()=>{
'use strict';
const source='https://github.com/Amulopapa67/open-yonsei-korean-vocabulary';
const cacheKey='sachi-yonsei-v8-corpus';
const baseKo=new Set(base.concat(extraWords).map(w=>w.ko.normalize('NFC').trim()));
let imported=false;
function addCorpus(rows){
 if(imported||!Array.isArray(rows))return;
 const unique=new Set(baseKo),add=[];
 for(const r of rows){
  const ko=String(r.korean||'').normalize('NFC').trim();const zh=String(r.chinese||'').trim();
  if(!ko||!zh||unique.has(ko)||!/[가-힣]/.test(ko)||ko.length>35||zh.length>110)continue;
  if(r.entry_kind==='grammar')continue;
  unique.add(ko);
  const vol=Number(r.volume)||2;
  const pos=String(r.pos||'');
  const cat=pos.includes('동사')?'verb':pos.includes('형용사')?'adj':/여행|교통|공항/.test(zh)?'travel':'basic';
  add.push({id:'y'+String(r.entry_id||`${vol}-${add.length}`),ko,zh,ro:'',cat,level:Math.min(4,Math.max(1,vol))});
 }
 if(!add.length)return;
 extraWords.push(...add);imported=true;
 $('wordCount').textContent=`当前收录 ${words().length} 词 · 已扩充`;
 if(!$('book').classList.contains('hidden'))list();
 if(!$('review').classList.contains('hidden'))renderReviewStats();
 notify(`🌸 新词库加载成功！目前 ${words().length} 个词条`);
}
function cached(){try{const v=JSON.parse(localStorage.getItem(cacheKey)||'null');if(Array.isArray(v)&&v.length>1200)addCorpus(v)}catch{}}
async function fetchVolume(vol){
 const file=`data/json/vol-0${vol}.json`;
 const urls=[`https://raw.githubusercontent.com/Amulopapa67/open-yonsei-korean-vocabulary/main/${file}`,`https://cdn.jsdelivr.net/gh/Amulopapa67/open-yonsei-korean-vocabulary@main/${file}`];
 for(const url of urls){try{const response=await fetch(url,{cache:'force-cache'});if(!response.ok)continue;const json=await response.json();if(Array.isArray(json.rows))return json.rows;}catch(e){/* try backup */}}
 return [];
}
async function loadCorpus(){
 cached();if(imported)return;
 const chunks=await Promise.all([1,2,3,4].map(fetchVolume));const all=chunks.flat();
 if(all.length>1200){try{localStorage.setItem(cacheKey,JSON.stringify(all))}catch{};addCorpus(all)}
 else{$('wordCount').textContent=`当前收录 ${words().length} 词 · 扩充词库待联网加载`;notify('扩充词库暂未下载成功，请联网刷新后重试');}
}
loadCorpus();
// Spaced repetition (simple SM-2 inspired schedule; no claims of official exam grading).
state.srs=state.srs&&typeof state.srs==='object'?state.srs:{};
const now=()=>Date.now();
function recordReview(w,grade,updateKnown=true){
 const old=state.srs[w.id]||{interval:0,reps:0,ease:2.5};
 let interval=0,reps=old.reps||0,ease=old.ease||2.5;
 if(grade===0){reps=0;interval=0;ease=Math.max(1.3,ease-.2)}
 else if(grade===1){reps=Math.max(1,reps);interval=1;ease=Math.max(1.3,ease-.1)}
 else if(grade===2){reps++;interval=reps===1?1:reps===2?3:Math.max(3,Math.round((old.interval||3)*ease))}
 else {reps++;interval=reps===1?3:reps===2?7:Math.max(7,Math.round((old.interval||7)*(ease+.2)));ease=Math.min(3,ease+.05)}
 const due=now()+(grade===0?10*60*1000:interval*86400000);
 state.srs[w.id]={interval,reps,ease,due,last:now()};
 if(updateKnown&&grade===0){state.wrong[w.id]=(state.wrong[w.id]||0)+1;state.known[w.id]=Math.max(0,(state.known[w.id]||0)-1)}
 else if(updateKnown)state.known[w.id]=(state.known[w.id]||0)+1;
 state.daily[today()]=[...new Set([...(state.daily[today()]||[]),w.id])];
 save();stats();
}
const oldMark=mark;
mark=function(ok){const w=current;if(w){recordReview(w,ok?2:0,false)}oldMark(ok);renderReviewStats()};
let reviewQueue=[],reviewCurrent=null,reviewRevealed=false;
function dueWords(){return words().filter(w=>state.srs[w.id]&&state.srs[w.id].due<=now())}
function renderReviewStats(){
 $('dueCount').textContent=dueWords().length;
 $('reviewedCount').textContent=Object.keys(state.srs).length;
 const wrong=words().filter(w=>(state.wrong[w.id]||0)>0);
 $('weakCount').textContent=wrong.length;
 const holder=$('weakList');holder.replaceChildren();
 wrong.sort((a,b)=>(state.wrong[b.id]||0)-(state.wrong[a.id]||0)).slice(0,40).forEach(w=>{
  const div=document.createElement('div');div.className='worditem';
  const t=document.createElement('span');t.textContent=`${w.ko} · ${w.zh}（错 ${state.wrong[w.id]} 次）`;
  const b=document.createElement('button');b.textContent='🔊';b.onclick=()=>speak(w.ko);div.append(t,b);holder.append(div);
 });if(!wrong.length)holder.textContent='还没有易错词，继续加油 ♡';
}
function showReview(){
 reviewCurrent=reviewQueue.shift()||null;reviewRevealed=false;
 $('reviewAnswer').classList.add('hidden');
 $('reviewKo').textContent=reviewCurrent?.ko||'🎀 今日完成！';
 $('reviewZh').textContent=reviewCurrent?.zh||'';
 $('reviewHint').textContent=reviewCurrent?'先想想中文意思，再显示答案':'今天的复习完成啦 ♡';
 $('reviewReveal').disabled=!reviewCurrent;
 document.querySelectorAll('#reviewGrades button').forEach(b=>b.disabled=true);
 $('reviewStatus').textContent=reviewCurrent?`本轮还剩 ${reviewQueue.length+1} 张卡片`:'可以继续背新词，明天再来复习～';
 renderReviewStats();
}
function startReview(){
 const due=dueWords();
 const legacy=words().filter(w=>(state.wrong[w.id]||0)>0&&!state.srs[w.id]);
 const fresh=words().filter(w=>!state.srs[w.id]&&!(state.wrong[w.id]||0));
 const shuffled=fresh.sort(()=>Math.random()-.5);
 const seen=new Set();reviewQueue=[...due,...legacy.slice(0,10),...shuffled.slice(0,Math.max(0,10-due.length-legacy.length))].filter(w=>{if(seen.has(w.id))return false;seen.add(w.id);return true}).slice(0,25);
 showReview();
}
$('reviewStart').onclick=startReview;
$('reviewReveal').onclick=()=>{if(!reviewCurrent)return;reviewRevealed=true;$('reviewAnswer').classList.remove('hidden');document.querySelectorAll('#reviewGrades button').forEach(b=>b.disabled=false)};
$('reviewCard').onclick=()=>$('reviewReveal').click();
$('reviewCard').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('reviewReveal').click()}};
$('reviewSpeak').onclick=()=>{if(reviewCurrent)speak(reviewCurrent.ko)};
document.querySelectorAll('#reviewGrades button').forEach(b=>b.onclick=()=>{if(!reviewCurrent||!reviewRevealed)return;const grade=Number(b.dataset.grade);recordReview(reviewCurrent,grade);react(grade>0);gainXP(grade>0?4:1);showReview()});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
 $('review').classList.toggle('hidden',b.dataset.tab!=='review');
 if(b.dataset.tab==='review')renderReviewStats();
}));
renderReviewStats();
// Situational kaomoji, intentionally low-frequency.
const faces={morning:['(｡•̀ᴗ-)✧ 좋은 아침!','(˶ᵔ ᵕ ᵔ˶) 早安呀 ♡'],night:['(｡-ω-)zzz 잘 자요~','(っ˘ω˘ς ) 要早点休息呀'],touch:['(˶ˆᗜˆ˵) ♡','(๑•̀ㅂ•́)و✧','(ฅ´ω`ฅ) 喵～','( ˘ ³˘)♥'],study:['٩(ˊᗜˋ*)و 잘했어!','(๑˃ᴗ˂)ﻭ 好棒！'],room:['(ﾉ´ヮ`)ﾉ*:･ﾟ✧','(｡•̀ᴗ-)✧ 今天也加油！']};
let lastBubble=0;
function bubble(kind='touch',force=false){if(!force&&Date.now()-lastBubble<8000)return;lastBubble=Date.now();
 const arr=faces[kind]||faces.touch;sayRoom(arr[Math.floor(Math.random()*arr.length)]);
}
$('roomReact').onclick=()=>bubble('touch',true);
$('roomPet').onclick=()=>bubble('touch',true);
const originalReact=react;
react=function(ok){originalReact(ok);if(!$('room').classList.contains('hidden'))bubble(ok?'study':'room',true)};
setInterval(()=>{if(!$('room').classList.contains('hidden')){const hour=new Date().getHours();bubble(hour<6||hour>=22?'night':hour<11?'morning':'room')}},45000);
// Update appearance, count, and credits without changing user-owned assets.
const credit=document.createElement('p');credit.className='footer';credit.innerHTML='🌸 扩充词汇来源：<a href="'+source+'" target="_blank" rel="noopener">Open Yonsei Korean Vocabulary</a>（CC BY-SA 3.0）；词条级别按教材册次粗略映射，并非官方 TOPIK 等级。';
document.querySelector('.footer')?.after(credit);
renderRoom();
})();
