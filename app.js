(function(){
"use strict";
var D=null, S=null, KEY="pss-solve-v1", app=document.getElementById("app");
var V={};
var AI_URL="https://text.pollinations.ai/openai", AI_TIMEOUT=12000, aiBusy=false;

function fresh(){return {scr:"s1",hist:[],text1:"",path:null,s2:null,s2order:null,s3:null,root:null,surface:null,seen:[],hops:0,
  own:"",fixed:null,acts:[],more:false,rb:null,idea:null,first:null,date:null,dateISO:null,who:null,checkin:null,ai:false,tie:null,actOrder:null};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function load(){try{var x=JSON.parse(localStorage.getItem(KEY)||"null");if(!x||!x.scr)return null;var f=fresh();for(var k in f)if(x[k]===undefined)x[k]=f[k];return x;}catch(e){return null;}}
function el(tag,attrs,kids){var e=document.createElement(tag);attrs=attrs||{};var raw=attrs.raw;for(var k in attrs){if(k==="raw")continue;if(k==="text")e.textContent=raw?attrs[k]:TX(attrs[k]);else if(k==="on")e.addEventListener("click",attrs[k]);else if(k==="cls")e.className=attrs[k];else e.setAttribute(k,attrs[k]);}
  (kids||[]).forEach(function(c){if(c)e.appendChild(typeof c==="string"?document.createTextNode(raw?c:TX(c)):c);});return e;}
function lc(x){return /^I[ ']/.test(x)?x:x.charAt(0).toLowerCase()+x.slice(1);}
function isNotSure(x){return /^not sure/i.test(x||"");}
var STEP={s1:1,trade:1,pick:1,s2:2,cost:2,s3:3,evidence:3,money:3,fit:4,root:4,rootlist:4,person:4,dayone:4,how:4,own:4,fixed:5,test:4,actions:5,roadblock:6,idea:6,commit:6,plan:6,pricing:6};
function setStep_old(scr){var n=STEP[scr]||(scr in {saved:1,checkback:1,team:1,commits:1,me:1}?6:1);document.getElementById("steplabel").textContent=scr==="plan"?"Done":(scr in {saved:1,checkback:1,team:1,commits:1,me:1})?"Saved on this device":"Step "+n+" of 6";
  document.getElementById("barfill").style.width=(scr==="plan"?100:Math.round(n/6*100-8))+"%";}
function go(scr,noHist){if(LOCKS&&LOCKED[scr]){toast(D.sell.locked);scr="pricing";}if((scr==="s2"||scr==="pick")&&!S.trade&&S.text1){var dt=detectTrade(S.text1);if(dt){S.trade=dt;S.tradeAuto=1;}}if((scr==="s2"||scr==="pick")&&!S.trade){var lt=learn().trade;if(lt){S.trade=lt;S.tradeAuto=1;}}if(!noHist&&S.scr!==scr)S.hist.push(S.scr);S.scr=scr;save();render(true);}
function back(){if(!S.hist.length)return;S.scr=S.hist.pop();save();render(true);}
function toast(t){var x=el("div",{cls:"toast",text:t});x.dataset.ts=Date.now();document.body.appendChild(x);setTimeout(function(){x.remove();},1800);}
function clearToasts(){var now=Date.now();Array.prototype.forEach.call(document.querySelectorAll(".toast"),function(x){if(now-(+x.dataset.ts||0)>60)x.remove();});}
function P(){return D.paths[S.path];}
function R(id){return D.roots[id];}
function EV(){var c=S.path&&S.s2!=null&&D.paths[S.path]&&D.paths[S.path].s2[S.s2];return (c&&D.evidence[c.id])||D.evidence[S.path];}
function noneBtn(fn){return el("button",{cls:"link none",text:D.rules.every_list_has,on:fn});}
function nav(){return el("div",{cls:"nav noprint"},[S.hist.length?el("button",{cls:"link",text:"‹ Back",on:back}):el("span"),
  S.scr!=="s1"?el("button",{cls:"link small",text:"Start over",on:startOver}):el("span")]);}
function startOver(){var ai=S.ai,tr=S.trade;S=fresh();S.ai=ai;S.trade=tr;save();render(true);}
// tap a card: highlight, glide, then continue
function tapCard(btn,list,fn){if(list.classList.contains("fading"))return;btn.classList.add("on","chosen");list.classList.add("fading");setTimeout(fn,matchMedia("(prefers-reduced-motion: reduce)").matches?0:360);}
function cardList(items,onPick,opts){opts=opts||{};var limit=opts.limit||5,box=el("div",{cls:"cards"});var wrap=el("div",{},[box]);
  function draw(all){box.innerHTML="";items.slice(0,all?items.length:limit).forEach(function(it){var b=el("button",{cls:"card",text:it.label});b.addEventListener("click",function(){tapCard(b,box,function(){onPick(it);});});box.appendChild(b);});}
  draw(false);if(items.length>limit){var m=el("button",{cls:"link",text:"Show more",on:function(){draw(true);m.remove();}});wrap.appendChild(m);}
  return wrap;}

// ---------- routing ----------
function norm(t){return " "+(t||"").toLowerCase().replace(/['’]/g,"")+" ";}
var KWC={};function kwRe(kw){if(KWC[kw])return KWC[kw];var k=kw.replace(/'/g,""),op=/\*$/.test(k);if(op)k=k.slice(0,-1);
  var re;try{re=new RegExp("\\b(?:"+k+")"+(op?"":"(?:s|es|d|ed|ing)?\\b"));}catch(e){re=null;}return (KWC[kw]=re);}
// Whole-word keywords with weights. Generic people words weigh 1, specific signals 2-4. Low confidence -> "Which is closest?".
function route(text){var t=norm(text),sc={},card={};
  D.routing.rules.forEach(function(r){var w=r.w||(r.s2===null?1:2);r.keywords.forEach(function(kw){var re=kwRe(kw);
    if(re&&re.test(t)){sc[r.path]=(sc[r.path]||0)+w;if(r.s2!==null){card[r.path]=card[r.path]||{};card[r.path][r.s2]=(card[r.path][r.s2]||0)+w;}}});});
  var wm=t.match(new RegExp(D.r4.worn_words,"g"));if(wm)sc.wornout=(sc.wornout||0)+3*wm.length;
  var ranked=Object.keys(sc).sort(function(a,b){return sc[b]-sc[a];});
  if(!ranked.length)return {path:null};
  var top=ranked[0],slack=card[top]?0:1,near=ranked.filter(function(k){return sc[k]>=sc[top]-slack;}).slice(0,3);
  if(near.length>1)return {path:null,tie:near};
  var c=card[top]||{};return {path:top,cards:Object.keys(c).map(Number).sort(function(a,b){return c[b]-c[a]||a-b;})};}
function orderFrom(first,n){var o=[];first.forEach(function(i){if(o.indexOf(i)<0&&i>=0&&i<n)o.push(i);});for(var i=0;i<n;i++)if(o.indexOf(i)<0)o.push(i);return o;}

// ---------- optional AI re-rank (one at a time, short, silent fallback) ----------
function askAI(prompt){if(!S.ai||aiBusy||!window.fetch)return Promise.resolve(null);aiBusy=true;
  var ctl=window.AbortController?new AbortController():null,timer=setTimeout(function(){if(ctl)ctl.abort();},AI_TIMEOUT);
  return fetch(AI_URL,{method:"POST",headers:{"Content-Type":"application/json"},signal:ctl?ctl.signal:undefined,
    referrerPolicy:"no-referrer",credentials:"omit",cache:"no-store",
    body:JSON.stringify({model:"openai",private:true,messages:[{role:"system",content:"Reply with one short JSON object only. No prose."},{role:"user",content:scrub(prompt)}]})})
  .then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(d){var c=d.choices[0].message.content;return JSON.parse(c.slice(c.indexOf("{"),c.lastIndexOf("}")+1));})
  .catch(function(){return null;}).then(function(x){clearTimeout(timer);aiBusy=false;window.__aiLast=x?"ok":"fallback";return x;});}
function aiRoute(text){var paths=Object.keys(D.paths),lines=paths.map(function(k){return k+": "+D.paths[k].label+" | "+D.paths[k].s2.map(function(c,i){return i+"="+c.label;}).join("; ");}).join("\n");
  return askAI('A small-business owner wrote: "'+text.slice(0,200)+'". Pick the closest path and order its cards, most likely first.\n'+lines+'\nReturn {"path":"<key>","order":[card numbers]}')
  .then(function(x){if(!x||!D.paths[x.path]||!Array.isArray(x.order))return null;return {path:x.path,cards:x.order.map(Number)};});}
function aiActions(rootId,list,own){return askAI('Owner note: "'+own.slice(0,200)+'". Problem root: "'+R(rootId).statement+'". Order these first steps, best fit first:\n'+list.map(function(a,i){return i+"="+a;}).join("\n")+'\nReturn {"order":[numbers]}')
  .then(function(x){return x&&Array.isArray(x.order)?x.order.map(Number):null;});}


// ---------- speech (Web Speech API); hidden if unsupported ----------
var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
function micFor(ta,onChange){if(!SR)return null;var rec=null,on=false,base="";
  var btn=el("button",{cls:"mic",type:"button","aria-pressed":"false"},[el("span",{cls:"dot"}),el("span",{cls:"miclabel",text:"Rather say it? Tap and talk."})]);
  var tidy=el("button",{cls:"link tidy",type:"button",text:"Tidy this up"});tidy.style.display="none";
  function stop(){on=false;btn.classList.remove("live");btn.setAttribute("aria-pressed","false");btn.querySelector(".miclabel").textContent="Rather say it? Tap and talk.";try{rec&&rec.stop();}catch(e){}
    if(S.ai&&ta.value.trim().length>12)tidy.style.display="inline-block";}
  var note=el("p",{cls:"micnote",raw:"1",text:D.r2.mic_notice});note.style.display="none";
  btn.addEventListener("click",function(){if(on){stop();return;}
    if(!localStorage.getItem("pss-micok")){try{localStorage.setItem("pss-micok","1");}catch(e){}note.style.display="block";btn.querySelector(".miclabel").textContent=D.r2.mic_again;return;}
    note.style.display="none";
    try{rec=new SR();}catch(e){btn.remove();return;}rec.lang="en-US";rec.continuous=true;rec.interimResults=true;base=ta.value?ta.value.replace(/\s*$/," "):"";
    rec.onresult=function(ev){var fin="",intr="";for(var i=0;i<ev.results.length;i++){var r=ev.results[i];if(r.isFinal)fin+=r[0].transcript;else intr+=r[0].transcript;}
      ta.value=(base+fin+intr).replace(/^\s+/,"");onChange(ta.value);};
    rec.onerror=function(e){if(e.error==="not-allowed"||e.error==="service-not-allowed"){btn.remove();}stop();};
    rec.onend=function(){if(on)stop();};
    try{rec.start();on=true;btn.classList.add("live");btn.setAttribute("aria-pressed","true");btn.querySelector(".miclabel").textContent="Listening… tap to stop";}catch(e){stop();}});
  tidy.addEventListener("click",function(){tidy.textContent="One moment…";
    askAI('Rewrite this business owner\'s spoken words as one or two short, plain sentences in first person. Keep the meaning and the feeling. Remove profanity and filler. Do not judge or add advice. Words: "'+ta.value.slice(0,400)+'". Return {"text":"..."}')
    .then(function(x){if(x&&typeof x.text==="string"&&x.text.trim()){ta.value=x.text.trim().slice(0,300);onChange(ta.value);tidy.style.display="none";}else{tidy.textContent="Tidy this up";toast("Kept as is");}});});
  return el("div",{cls:"microw"},[btn,note,tidy]);}

// ---------- person profile ----------
function chipsMulti(opts,cur,onChange){var row=el("div",{cls:"row"});cur=cur||[];opts.forEach(function(o){var c=el("button",{cls:"chip"+(cur.indexOf(o)>=0?" on":""),text:o});c.dataset.v=o;
  c.addEventListener("click",function(){var i=cur.indexOf(o);if(i>=0)cur.splice(i,1);else{if(o==="Not sure")cur.length=0;else{var k=cur.indexOf("Not sure");if(k>=0)cur.splice(k,1);}cur.push(o);}
    Array.prototype.forEach.call(row.children,function(x){x.classList.toggle("on",cur.indexOf(x.dataset.v)>=0);});onChange(cur);});row.appendChild(c);});return row;}
function profileMic(){var ta=el("textarea",{rows:"2","aria-label":"In my own words",maxlength:"500"});ta.value=S.own||"";ta.style.display=S.own?"block":"none";
  ta.addEventListener("input",function(){S.own=ta.value;save();});
  var m=micFor(ta,function(v){ta.style.display="block";S.own=v;save();});if(!m)return null;
  return el("div",{cls:"pmic"},[el("p",{cls:"small",text:D.profile.dayone.mic_note}),m,ta]);}
function arr(a){return Array.isArray(a)?a:(a?[a]:[]);}
function realPicks(a){return arr(a).filter(function(x){return !isNotSure(x);});}
function has(a,x){return arr(a).indexOf(x)>=0;}
function classify(){var p=S.prof||{},d=p.delta||{},how=p.how||{},br=p.brought||[];
  var ex=realPicks(how.expect),clear=ex.length===1&&ex[0]==="Clearly agreed, in writing",repeat=has(how.since,"Still happens, more than once"),td=realPicks(p.today);
  if(!clear&&!repeat)return "dontknow";
  if(d.role&&d.role!=="Same")return "cant";
  if((br.indexOf("Cheap or available")>=0||br.indexOf("Friend or family")>=0)&&br.indexOf("Skilled")<0&&!repeat)return "cant";
  var load=["volume","systems","reports","lead","paylife","person"].filter(function(k){return d[k]&&d[k]!=="Same"&&!(k==="volume"&&d[k]==="Lighter");});
  if(has(td,"Carrying more than before")||has(td,"Hit a ceiling, no next step")||has(td,"Their ideas aren't heard anymore"))return "notsetup";
  if(load.length&&!(repeat&&clear&&load.length===1&&load[0]==="person"))return "notsetup";
  if(repeat&&clear)return "wont";return "dontknow";}
function isOut(p){p=p||S.prof;return !!(p&&D.r5.outside.indexOf(p.type)>=0);}
function profileOut(){var P0=D.profile,p=S.prof;if(!p||!p.type)return null;
  if(isOut(p)){var X=D.r5.types[p.type];return {cls:"outside",out:true,C:{label:X.label,steps:X.steps,test:X.test,opener:X.opener},opener:X.opener,adds:[],typeLabel:P0.ask.options.filter(function(o){return o[0]===p.type;})[0][1],changed:[],listen:false};}
  var cls=classify(),C=P0.classes[cls],how=p.how||{},d=p.delta||{};
  var changed=P0.dayone.delta.filter(function(f){return d[f.id]&&d[f.id]!=="Same";});
  var opener=C.opener;if(cls==="notsetup"&&changed.length){var f=changed.filter(function(x){return !(x.id==="volume"&&d.volume==="Lighter");})[0];if(f&&P0.openers_by_delta[f.id])opener=P0.openers_by_delta[f.id];}
  var adds=[];if(p.type==="longtime")adds.push(P0.adds.longtime);
  ["direction","disagree","driver"].forEach(function(k){realPicks(how[k]).forEach(function(v){var t=P0.adds[k][v];if(t)adds.push(t);});});
  var typeLabel=P0.ask.options.filter(function(o){return o[0]===p.type;})[0][1];
  var listen=realPicks(p.today).length>=P0.dayone.listen.min_picks;
  return {cls:cls,C:C,opener:opener,adds:adds,typeLabel:typeLabel,changed:changed,listen:listen};}
V.person=function(){var A=D.profile.ask,items=A.options.map(function(o){return {label:o[1],k:o[0]};});
  return [el("h1",{text:A.heading}),cardList(items,function(it){S.prof={type:it.k,brought:[],today:[],delta:{},how:{}};go("pq");},{limit:6}),
    el("button",{cls:"link none",text:A.none,on:function(){S.prof=null;go("test");}}),nav()];};
V.dayone=function(){var P0=D.profile.dayone,p=S.prof,kids=[el("h1",{text:P0.heading})];
  kids.push(el("div",{cls:"q",text:P0.brought.q}),chipsMulti(P0.brought.options,p.brought,function(c){p.brought=c;save();}));
  kids.push(el("div",{cls:"q",text:P0.great_then}),chips(P0.strengths,p.then,function(o){p.then=o;save();}));
  kids.push(el("p",{cls:"sub",text:P0.sub}),el("div",{cls:"q",text:P0.today.q}),chipsMulti(P0.today.options,p.today||(p.today=[]),function(c){p.today=c;save();}));
  kids.push(el("div",{cls:"q",text:P0.delta_q}));
  var grid=el("div",{cls:"delta"});P0.delta.forEach(function(f){p.delta[f.id]=p.delta[f.id]||P0.default;
    grid.appendChild(el("div",{cls:"drow"},[el("div",{cls:"dlabel",text:f.label}),chips(f.opts,p.delta[f.id],function(o){p.delta[f.id]=o;save();})]));});
  kids.push(grid);
  kids.push(el("div",{cls:"q",text:P0.still_best}),chips(P0.strengths,p.now,function(o){p.now=o;save();}));
  kids.push(profileMic(),el("button",{cls:"btn",text:"Next",on:function(){go("how");}}),nav());return kids;};
V.how=function(){var H=D.profile.how,p=S.prof,kids=[el("h1",{text:H.heading})];
  kids.push(el("p",{cls:"sub",text:H.sub}));["direction","disagree","driver","expect","since"].forEach(function(k){p.how[k]=arr(p.how[k]);kids.push(el("div",{cls:"q",text:H[k].q}),chipsMulti(H[k].options,p.how[k],function(c){p.how[k]=c;save();}));});
  kids.push(profileMic(),el("button",{cls:"btn",text:"Next",on:function(){S.detail=0;savePlan();go("plan");}}),nav());return kids;};


// ---------- conversation template ----------
function talkPlan(){var T=D.profile.talk,po=profileOut();var first=S.first||"";
  if(S.path!=="people"&&!S.prof)return null;if(!po&&!(new RegExp(T.person_words,"i")).test(first))return null;
  var cls=po&&!po.out?po.cls:"dontknow",type=(S.prof&&S.prof.type)||"employee",C=T.classes[cls],ty=T.types[type]||T.types.employee;
  var X=po&&po.out?D.r5.types[type]:null;if(X)C={own:X.own,ask:C.ask,backup:X.backup,dont:X.dont,defensive:X.defensive};
  var dt=nice(iso(addDays(7))),fact=T.fact_none;
  if(S.ev&&S.path&&EV()){var E=EV(),f=[];S.ev.forEach(function(v,qi){if(v!=null&&v>=0)f.push(lc(E.questions[qi].options[v].label));});if(f.length)fact=T.fact_prefix+" "+f.join("; ")+".";}
  if(X){var sg=realPicks(S.prof.signs||[]),fam=S.prof.type==="family";fact=sg.length?(fam?D.r5.fact_prefix_family:D.r5.fact_prefix)+" "+sg.map(function(x){return (D.r5.sign_facts[x]||x).toLowerCase();}).join("; ")+".":T.fact_none;}
  var tr=S.test?S.test.try:first,wt=S.test?S.test.watch:"Whether it gets done";
  var own=(ty.own_prefix?ty.own_prefix+" ":"")+toneSwap(C.own);
  var parts=[[T.parts[0],own],[T.parts[1],(ty.ask||C.ask)+" "+T.if_quiet+" "+C.backup],[T.parts[2],fact],
    [T.parts[3],(X?X.agree:T.agree).replace("{test}",lc(tr)).replace("{watch}",lc(wt))],[T.parts[4],(X?X.checkback:T.checkback).replace("{date}",dt)]];
  var traits=S.prof?realPicks(S.prof.brought).concat(realPicks(S.prof.then)):[];
  var tk0=toneKey(),tn=D.tone[tk0]&&tk0!=="generic"?D.tone[tk0].talk_note:"";ty={tip:(tn?tn+" ":"")+ty.tip};
  return {title:T.title,name:S.prof&&S.prof.name?"With: "+S.prof.name:T.name_blank+(S.prof&&S.prof.label?" ("+capL(S.prof.label)+")":""),tip:ty.tip,traits:traits,parts:parts,dont:C.dont,defensive:C.defensive.replace("{date}",dt)};}

// ---------- screens ----------
V.s1=function(){var s=D.screen1;var ta=el("textarea",{rows:"2",placeholder:s.placeholder,"aria-label":"What's driving me crazy",maxlength:"400",id:"t1"});ta.value=S.text1||"";
  var next=el("button",{cls:"btn",text:"Next",on:function(){var v=ta.value.trim();if(!v)return;S.text1=v;save();submitText(v);}});next.disabled=!ta.value.trim();
  ta.addEventListener("input",function(){next.disabled=!ta.value.trim();S.text1=ta.value;save();});
  ta.addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();next.click();}});
  var btns=Object.keys(D.paths).map(function(k){return {label:D.paths[k].label,k:k};});
  var tg=el("input",{type:"checkbox","aria-label":"AI suggestions"});tg.checked=!!S.ai;var aiNote=el("p",{cls:"privacy ainote",raw:"1",text:D.privacy.ai_on});aiNote.style.display=S.ai?"block":"none";var soldP=el("p",{cls:"privacy sold",raw:"1",text:D.privacy.sold_s1});soldP.style.display=S.ai?"none":"block";tg.addEventListener("change",function(){S.ai=tg.checked;aiNote.style.display=S.ai?"block":"none";soldP.style.display=S.ai?"none":"block";save();});
  var ret=retCard();
  return [ret,el("h1",{text:s.heading}),ta,micFor(ta,function(v){S.text1=v;next.disabled=!v.trim();save();}),next,el("p",{cls:"reassure",text:s.reassure}),el("div",{cls:"or",text:s.or_label}),
    cardList(btns,function(it){S.text1="";pickPath(it.k,[]);},{limit:6}),noneBtn(function(){S.text1="";pickPath("off",[]);}),
    el("label",{cls:"toggle"},[el("span",{cls:"switch"},[tg,el("span")]),D.privacy.ai_label]),aiNote,soldP];};
function openPlan(){var L=plans();for(var i=0;i<L.length;i++){var p=L[i],it=(p.items||[]).filter(function(x){return (x.kind==="first"||x.kind==="test")&&!x.done&&!x.dropped;})[0];if(it)return {p:p,it:it};}return null;}
function retCard(){var o=openPlan(),Q=D.r2;if(!o||S.retLater===o.p.id||S.text1)return null;if(o.p.snoozeTo&&o.p.snoozeTo>today())return null;
  function ck(d){if(d===D.cont.ck_opts[2]){var p2=getPlan(o.p.id);if(p2){p2.snoozeTo=iso(addDays(1));putPlan(p2);}}S.ckId=o.p.id;S.ck={did:d,noticed:null,fromRet:1};go("checkback");}
  return el("div",{cls:"retcard"},[el("div",{cls:"q",text:Q.ret_q}),el("p",{cls:"retline",raw:"1",text:Q.ret_line.replace("{move}",o.it.text).replace("{date}",nice(o.it.due||o.p.dateISO||iso(new Date())))}),
    el("div",{cls:"row"},[el("button",{cls:"chip",text:Q.ret_yes,on:function(){ck(D.cont.ck_opts[0]);}}),el("button",{cls:"chip",text:Q.ret_no,on:function(){ck(D.cont.ck_opts[2]);}}),el("button",{cls:"chip",text:Q.ret_later,on:function(){S.retLater=o.p.id;save();render(false);}})])]);}
function pickPath(k,cards){S.path=k;S.s2order=orderFrom(cards||[],P().s2.length);S.s2=S.s3=S.root=null;S.seen=[];S.hops=0;go("s2");}
function submitText(v){var kw=route(v);
  if(S.ai){app.innerHTML="";app.appendChild(el("div",{cls:"screen"},[el("div",{cls:"wait",text:"One moment…"})]));
    aiRoute(v).then(function(a){finishRoute(a||kw);});}else finishRoute(kw);}
function finishRoute(r){if(r.path)return pickPath(r.path,r.cards);S.tie=r.tie||null;go("pick");}
V.pick=function(){var keys=S.tie||Object.keys(D.paths);var items=keys.map(function(k){return {label:D.paths[k].label,k:k};});
  return [el("h1",{text:S.tie&&S.tie.length===2?"Which is closer?":"Which is closest?"}),cardList(items,function(it){pickPath(it.k,[]);},{limit:6}),
    noneBtn(function(){if(S.tie){S.tie=null;render(true);}else pickPath("off",[]);}),nav()];};
V.s2=function(){var p=P(),items=S.s2order.map(function(i){return {label:p.s2[i].label,i:i};});
  return [el("h1",{text:D.screens.s2.heading}),cardList(items,function(it){S.s2=it.i;S.mk=null;S.costs=[];go(costOpts()?"cost":(S.path==="money"?"money":"s3"));},{limit:items.length}),
    noneBtn(function(){S.s3=null;S.notsure=true;go("rootlist");}),nav()];};
function costOpts(){var c=S.path&&S.s2!=null&&D.paths[S.path]&&D.paths[S.path].s2[S.s2];return c&&D.costs&&D.costs[c.id];}
V.cost=function(){var C=D.cost,o=costOpts()||[];S.costs=S.costs||[];var nx=function(){go(S.path==="money"?"money":"s3");};
  return [el("h1",{text:C.heading}),el("p",{cls:"sub",text:C.sub}),chipsMulti(o,S.costs,function(c){S.costs=c;save();}),
    el("button",{cls:"btn",text:C.next,on:nx}),el("button",{cls:"link",text:C.skip,on:function(){S.costs=[];nx();}}),nav()];};
V.s3=function(){var c=P().s2[S.s2],sub=(D.screens.s3.sub_override||{})[S.path]||D.screens.s3.sub;
  var items=c.s3.map(function(x,j){return {label:x.label,j:j};});
  return [el("h1",{text:D.screens.s3.heading}),el("p",{cls:"sub",text:sub}),cardList(items,function(it){S.s3=it.j;var x=c.s3[it.j];
      S.ev=[null,null,null];go("evidence");}),
    noneBtn(function(){S.s3=null;S.notsure=true;go("rootlist");}),nav()];};
function setRoot(id,surface){S.test=null;if(surface){S.surface=id;S.seen=[id];S.hops=0;}else{S.seen.push(id);}S.root=id;S.acts=[];S.test=null;S.actOrder=null;S.fixed=null;S.rb=S.idea=S.first=null;}
V.evidence=function(){var E=EV(),ns=D.screens.evidence.not_sure,kids=[el("h1",{text:E.intro+"…"}),el("p",{cls:"sub",text:D.screens.evidence.sub})];
  S.ev=S.ev||[null,null,null];var next=el("button",{cls:"btn",text:"Next",on:function(){inferRoot();}});
  function upd(){next.disabled=S.ev[0]===null;save();}var more=el("details",{cls:"evmore"},[el("summary",{text:D.r4.add_more})]);if(S.ev[1]!==null&&S.ev[1]!==-1||S.ev[2]!==null&&S.ev[2]!==-1)more.open=true;
  E.questions.forEach(function(q,qi){var T=qi?more:null,add=function(k){if(T)T.appendChild(k);else kids.push(k);};add(el("div",{cls:"q",text:q.q}));var labels=q.options.map(function(o){return o.label;}).concat([ns]);
    add(chips(labels,S.ev[qi]===null?null:(S.ev[qi]===-1?ns:labels[S.ev[qi]]),function(o){S.ev[qi]=o===ns?-1:labels.indexOf(o);upd();}));if(!qi)kids.push(more);});
  upd();kids.push(next,nav());return kids;};
function inferRoot(){var c=P().s2[S.s2].s3[S.s3],sc={},E=EV(),ns=isNotSure(c.label);
  if(!ns)sc[c.root]=2;S.ev.forEach(function(v,qi){if(v!=null&&v>=0)E.questions[qi].options[v].roots.forEach(function(r){sc[r]=(sc[r]||0)+1;});});
  var keys=Object.keys(sc);if(!keys.length){S.notsure=true;go("rootlist");return;}
  keys.sort(function(a,b){return sc[b]-sc[a]||(a===c.root?-1:b===c.root?1:0);});
  S.notsure=false;S.prof=null;setRoot(keys[0],true);S.inferred=keys.slice(1,4);go("root");}
V.root=function(){var r=R(S.root),deep=r.deeper.filter(function(d){return S.seen.indexOf(d)<0;}),A=D.adapt,dfn=signals().defensive;
  var kids=[el("h1",{text:dfn?A.test_heading:D.screens.root.heading}),
   el("div",{cls:"cards"},[el("div",{cls:"card root",text:r.statement})])];
  if(dfn&&S.path==="people"){S.theirSide=S.theirSide||[];kids.push(el("h2",{cls:"theirq",text:A.theirside_q}),el("p",{cls:"sub",text:A.theirside_sub}),
    chipsMulti(A.theirside.map(function(x){return x[0];}),S.theirSide,function(){save();}));}
  if(S.path==="money"&&S.mk&&S.mk.cash===D.flow2.cash[3]&&S.root===D.moneycheck.root)kids.splice(1,0,el("p",{cls:"ack",text:D.r2.fear}));
  if(S.path==="money"&&S.mk&&S.mk.cash===D.flow2.cash[0])kids.splice(1,0,el("p",{cls:"ack",text:D.r2.triage}));
  var PA=D.profile.ask,R3=D.r3,mainK=R3.person_main.map(function(x){return x[0];}),moreO=PA.options.filter(function(o){return mainK.indexOf(o[0])<0;});
  function setP(k){if(!k){S.prof=null;}else{var lab=PA.options.filter(function(x){return x[0]===k;})[0][1];if(!S.prof||S.prof.type!==k)S.prof={type:k,typeLabel:lab,brought:[],today:[],delta:{},how:{}};}S.who=null;S.whoPicked=false;outRoot();save();}
  var isMore=S.prof&&mainK.indexOf(S.prof.type)<0,curM=!S.prof?R3.person_none:(isMore||S.pOther?R3.person_other:R3.person_main.filter(function(x){return x[0]===S.prof.type;})[0][1]);
  var moreBox=el("div",{cls:"pmore"});function drawMore(){moreBox.innerHTML="";if(!(S.pOther||isMore))return;moreBox.appendChild(el("div",{cls:"q small",text:R3.person_more_q}));
    moreBox.appendChild(chips(moreO.map(function(o){return o[1];}),S.prof&&isMore?S.prof.typeLabel:null,function(o){setP(moreO.filter(function(x){return x[1]===o;})[0][0]);isMore=true;}));}
  kids.push(el("div",{cls:"q",text:D.r2.person_q}),chips(R3.person_main.map(function(x){return x[1];}).concat([R3.person_other,R3.person_none]),curM,function(o){
    if(o===R3.person_other){S.pOther=true;if(!isMore){S.prof=null;outRoot();}save();drawMore();return;}S.pOther=false;isMore=false;
    if(o===R3.person_none)setP(null);else setP(R3.person_main.filter(function(x){return x[1]===o;})[0][0]);drawMore();}),moreBox);drawMore();
  kids.push(ownLink());kids.push(el("button",{cls:"btn",text:dfn?A.test_button:D.screens.root.buttons[0],on:function(){S.testMode=dfn;go(S.prof?"pq":"test");}}));
  if(dfn&&S.s2!=null&&S.s3!=null&&P().s2[S.s2]&&P().s2[S.s2].s3)kids.push(el("button",{cls:"btn ghost",text:"Walk through the last time again",on:function(){go("evidence");}}));
  if(S.hops<D.screens.root.max_deeper&&deep.length)kids.push(el("button",{cls:"btn ghost",text:D.screens.root.buttons[1],on:function(){S.listMode="deeper";go("rootlist");}}));
  kids.push(el("button",{cls:"link",text:D.screens.root.buttons[2],on:function(){S.rejects=(S.rejects||0)+1;S.listMode="others";go("rootlist");}}));kids.push(nav());return kids;};
function outRoot(){var TR=D.r5.type_roots,all=[].concat(TR.vendor,TR.customer,TR.family),was=S.root;
  if(isOut()){var mine=TR[S.prof.type];if(mine.indexOf(S.root)<0){if(all.indexOf(S.root)<0)S.rootBeforeOut={root:S.root,surface:S.surface,seen:S.seen.slice(),hops:S.hops};var keep=S.prof;setRoot(mine[0],true);S.prof=keep;}}
  else if(S.rootBeforeOut&&all.indexOf(S.root)>=0){var b=S.rootBeforeOut;S.root=b.root;S.surface=b.surface;S.seen=b.seen;S.hops=b.hops;S.rootBeforeOut=null;}
  if(S.root!==was&&S.scr==="root"){save();setTimeout(function(){render(false);},0);}}
// ---------- opt-in feedback (round 5): nothing leaves the phone unless the owner presses send in their own email app ----------
var KEYF="pss-fb-v1";
function fbNames(){var n=[];try{var P0=people();Object.keys(P0).forEach(function(k){n.push(k);if(P0[k].name)n.push(P0[k].name);});}catch(e){}
  if(S.prof&&S.prof.name)n.push(S.prof.name);if(S.prof&&S.prof.label)n.push(S.prof.label);plans().forEach(function(p){var sn=p.snap||{};if(sn.prof&&sn.prof.name)n.push(sn.prof.name);if(sn.who)n.push(sn.who);});
  return n.filter(function(x){return x&&x.length>1&&!/^(my |just me|the whole|someone|a mentor)/i.test(x);});}
function fbScrub(t){var F=D.r5.fb;t=(t||"").replace(/\s+/g," ").trim().slice(0,300);
  t=t.replace(/(https?:\/\/|www\.)\S+/gi,"[link]").replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g,"[email]").replace(/\b[\w-]+\.(com|net|org|biz|io|co|us)(\/\S*)?\b/gi,"[link]").replace(/\+?\d[\d\s().-]{6,}\d/g,"[number]");
  fbNames().forEach(function(nm){t=t.replace(new RegExp("\\b"+nm.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","gi"),F.name_mask);});return t;}
function fbMailto(f){var F=D.r5.fb,L=[F.intro,"",F.l_rating+" "+f.rating,F.l_where+" "+f.where,F.l_root+" "+(f.root||F.none),F.l_trade+" "+(f.trade||F.none),F.l_miss+" "+(fbScrub(f.miss)||F.none)];
  return "mailto:"+FEEDBACK_TO+"?subject="+encodeURIComponent(F.subject)+"&body="+encodeURIComponent(L.join("\n"));}
function fbWidget(where,key,root,trade){var F=D.r5.fb,st=getJ(KEYF,{});if(st[key])return el("span",{cls:"fbdone"});
  var f={rating:null,miss:"",where:where,root:root,trade:trade},wrap=el("div",{cls:"fb noprint"});
  var send=el("button",{cls:"btn ghost fbsend",text:F.send});send.disabled=true;
  var ta=el("textarea",{rows:"2",maxlength:"300",placeholder:F.miss_ph,"aria-label":F.miss_q,cls:"fbmiss"});ta.addEventListener("input",function(){f.miss=ta.value;});
  var more=el("div",{cls:"fbmore"},[el("div",{cls:"q small",text:F.miss_q}),ta,micFor(ta,function(v){ta.value=v;f.miss=v;}),el("p",{cls:"meta fbpriv",text:F.privacy})]);
  function mark(v){var s0=getJ(KEYF,{});s0[key]=v;setJ(KEYF,s0);}
  send.addEventListener("click",function(){if(!f.rating)return;var u=fbMailto(f);window.__lastMailto=u;mark("sent");var a=el("a",{href:u});a.style.display="none";document.body.appendChild(a);try{a.click();}catch(e){}a.remove();
    wrap.innerHTML="";wrap.appendChild(el("p",{cls:"meta fbthanks",text:F.sent_thanks}));});
  var nn=el("button",{cls:"link fbnot",text:F.notnow,on:function(){mark("notnow");wrap.innerHTML="";wrap.appendChild(el("p",{cls:"meta",text:F.thanks}));}});
  var acts=el("div",{cls:"fbacts"},[send,nn]);more.hidden=true;acts.hidden=true;
  wrap.appendChild(el("div",{cls:"glabel",text:F.q}));wrap.appendChild(chips(F.opts,null,function(o){f.rating=o;send.disabled=false;more.hidden=false;acts.hidden=false;}));wrap.appendChild(more);
  wrap.appendChild(acts);return wrap;}
V.rootlist=function(){var ids,h;
  if(S.listMode==="deeper"&&S.scr==="rootlist"&&!S.notsure){ids=R(S.root).deeper.filter(function(d){return S.seen.indexOf(d)<0;});h="What might be behind that?";}
  else if(S.notsure){ids=P().root_list.slice(0,3);h="Could any of these be at the root?";}
  else{ids=P().root_list.filter(function(d){return S.seen.indexOf(d)<0;});h="Could any of these be at the root?";}
  var deeperMode=S.listMode==="deeper"&&!S.notsure;
  if(isOut()){var TR=D.r5.type_roots[S.prof.type],SR=D.r5.staff_roots;ids=TR.filter(function(d){return ids.indexOf(d)<0&&S.seen.indexOf(d)<0;}).concat(ids.filter(function(d){return SR.indexOf(d)<0;}));}
  var H0=learn();ids=learnSort(ids,function(id){return H0.rootN[id]||0;},H0);var items=ids.map(function(id){return {label:R(id).statement,id:id};});
  return [el("h1",{text:h}),cardList(items,function(it){if(deeperMode){S.hops++;setRoot(it.id,false);}else{setRoot(it.id,true);}S.notsure=false;S.listMode=null;go("root");}),
    noneBtn(function(){S.surface=S.root="general";S.seen=["general"];S.notsure=false;S.listMode=null;go("own");}),nav()];};
V.own=function(){var o=D.screens.own,ta=el("textarea",{rows:"3",placeholder:o.placeholder,maxlength:"500","aria-label":"In my own words"});ta.value=S.own||"";
  ta.addEventListener("input",function(){S.own=ta.value;save();});
  function next(){S.own=ta.value.trim();save();var list=actionList();
    if(S.ai&&S.own){app.innerHTML="";app.appendChild(el("div",{cls:"screen"},[el("div",{cls:"wait",text:"One moment…"})]));
      aiActions(S.root,list,S.own).then(function(ord){if(ord)S.actOrder=orderFrom(ord,list.length);go("test");});}else go("test");}
  return [el("h1",{text:o.heading}),ta,micFor(ta,function(v){S.own=v;save();}),el("button",{cls:"btn",text:"Next",on:next}),el("button",{cls:"btn ghost",text:"Skip",on:function(){ta.value="";S.own="";next();}}),nav()];};
V.fixed=function(){var r=R(S.root),items=r.fixed.map(function(f){return {label:f};});
  return [el("h1",{text:D.screens.fixed.heading}),el("p",{cls:"sub",text:D.screens.fixed.sub}),cardList(items,function(it){S.fixed=it.label;go("actions");}),
    noneBtn(function(){S.fixed=null;go("actions");}),nav()];};
V.test=function(){var t=D.screens.test,ex=R(S.root).experiments.slice(),box=el("div",{cls:"cards"});var po=profileOut();if(po)ex.unshift({try:po.C.test[0],watch:po.C.test[1]});if(triage())ex.unshift(D.r2.triage_test);if(S.path==="doing"&&!S.prof)ex.unshift(D.r3.solo_test);var seenT={};ex=ex.filter(function(x){if(seenT[x.try])return false;seenT[x.try]=1;return true;});ex=learnSort(ex,function(x,H){return actScore(x.try,H);});if(S.path==="doing"&&!S.prof)ex.sort(function(a,b){return (b===D.r3.solo_test)-(a===D.r3.solo_test);});
  ex.forEach(function(x){var b=el("button",{cls:"card test"},[el("span",{cls:"try",text:x.try}),el("span",{cls:"watch",text:t.watch_label+" "+lc(x.watch)})]);
    b.addEventListener("click",function(){tapCard(b,box,function(){S.test=x;S.fixed=null;S.acts=[x.try];S.first=x.try;go("commit");});});box.appendChild(b);});
  return [el("h1",{text:t.heading}),el("p",{cls:"sub",text:styleV("test_sub")||t.sub}),box,
    noneBtn(function(){S.test=null;S.acts=[];go("fixed");}),nav()];};
function actionList(){var r=R(S.root),al=r.actions_top3.concat(r.actions_more);var po=profileOut();if(po){al=po.C.steps.concat(al);if(po.listen)al=[D.profile.dayone.listen.step].concat(al);}
  if(S.surface&&S.root!==S.surface&&S.root!=="general")al=[al[0],al[1],R(S.surface).actions_top3[0]].concat(al.slice(2));
  var H=learn();if(H.n){al=learnSort(al,function(a){return actScore(a,H);},H);}if(S.test)al=[S.test.try].concat(al);
  var seen={};al=al.filter(function(a){if(seen[a])return false;seen[a]=1;return true;});
  if(S.actOrder&&!S.test){var o=S.actOrder;al=o.filter(function(i){return i<al.length;}).map(function(i){return al[i];});}return al;}
V.actions=function(){var al=actionList(),box=el("div",{cls:"cards"});if(!S.acts.length)S.acts=[al[0]];
  var next=el("button",{cls:"btn",text:"Next",on:function(){if(!S.acts.length)return;S.first=S.first&&S.acts.indexOf(S.first)>=0?S.first:S.acts[0];go("commit");}});
  function draw(){box.innerHTML="";al.slice(0,S.more?al.length:(styleV("actions_limit")||3)).forEach(function(a){var b=el("button",{cls:"card check"+(S.acts.indexOf(a)>=0?" on":""),text:a});
    b.addEventListener("click",function(){var i=S.acts.indexOf(a);if(i>=0)S.acts.splice(i,1);else if(S.acts.length<3)S.acts.push(a);else{toast("Up to 3");return;}
      b.classList.toggle("on",S.acts.indexOf(a)>=0);next.disabled=!S.acts.length;save();});box.appendChild(b);});}
  draw();var kids=[el("h1",{text:D.screens.actions.heading}),el("p",{cls:"sub",text:D.screens.actions.sub}),box];
  if(!S.more)kids.push(el("button",{cls:"link",text:"Show more",on:function(e){S.more=true;draw();e.target.remove();}}));
  kids.push(noneBtn(function(){S.root="general";S.surface=S.surface||"general";S.acts=[];S.actOrder=null;S.more=true;render(true);}));
  kids.push(next,nav());return kids;};
V.roadblock=function(){var r=R(S.root),items=r.roadblocks.map(function(k){return {label:D.roadblocks[k].label,k:k};});
  return [el("h1",{text:D.screens.roadblock.heading}),el("p",{cls:"sub",text:D.screens.roadblock.sub}),cardList(items,function(it){S.rb=it.k;go("idea");}),
    el("button",{cls:"link",text:D.screens.roadblock.skip,on:function(){S.rb=S.idea=null;go("plan");}}),noneBtn(function(){S.rb=S.idea=null;go("plan");}),nav()];};
V.idea=function(){var rb=D.roadblocks[S.rb],items=rb.ideas.map(function(i){return {label:"I'll "+lc(i)};});
  return [el("h1",{text:"If "+lc(rb.label)+"…"}),cardList(items,function(it){S.idea=it.label.replace(/^I'll /,"");go("plan");}),
    noneBtn(function(){S.rb=S.idea=null;go("plan");}),nav()];};
function addDays(n){var d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+n);return d;}
function chipDate(label){var dow=new Date().getDay();
  if(label==="Tomorrow")return addDays(1);if(label==="Within 3 days")return addDays(3);if(label==="Within 7 days")return addDays(7);
  if(label==="By Friday"){var n=(5-dow+7)%7;return addDays(n===0?0:n);}return null;}
function iso(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function nice(isoS){var p=isoS.split("-");return new Date(+p[0],+p[1]-1,+p[2],12).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});}
function chips(opts,cur,onPick){var row=el("div",{cls:"row"});opts.forEach(function(o){var c=el("button",{cls:"chip"+(o===cur?" on":""),text:o});
  c.addEventListener("click",function(){Array.prototype.forEach.call(row.children,function(x){x.classList&&x.classList.remove("on");});c.classList.add("on");onPick(o,row);});row.appendChild(c);});return row;}
V.commit=function(){var c=D.screens.commit,one=S.acts.length<=1&&S.first,kids=[el("h1",{text:one?S.first+". "+D.flow2.commit_when:c.heading})];
  var other=needsOther(S.first);if(other&&S.who===D.helpers.me)S.who=null;
  var ph=profHelper();if(!S.who||(ph&&S.who!==ph&&!S.whoPicked)){var g=guessHelper();S.who=other&&g===D.helpers.me?null:g;}if(!S.date){S.date="By Friday";S.dateISO=iso(chipDate("By Friday"));}
  var mk=el("button",{cls:"btn",text:c.button,on:function(){if(S.dateISO&&S.who)go("plan");}});mk.disabled=!S.dateISO||!S.who;
  if(S.acts.length>1){kids.push(el("div",{cls:"q",text:c.q_first}));kids.push(chips(S.acts,S.first,function(o){S.first=o;save();}));}
  kids.push(el("div",{cls:"q",text:c.q_when}));
  var dateIn=el("input",{type:"date",min:iso(addDays(0)),max:iso(addDays(c.date_max_days||7)),"aria-label":"Pick a date"});dateIn.style.display="none";
  dateIn.addEventListener("change",function(){if(dateIn.value){S.date="Pick a date";S.dateISO=dateIn.value;mk.disabled=false;save();}});
  kids.push(chips(D.dates,S.date,function(o){S.date=o;if(o==="Pick a date"){dateIn.style.display="inline-block";S.dateISO=dateIn.value||null;try{dateIn.showPicker&&dateIn.showPicker();}catch(e){}}
    else{dateIn.style.display="none";S.dateISO=iso(chipDate(o));}mk.disabled=!S.dateISO||!S.who;save();}),dateIn);
  var hand=(new RegExp(D.r5.hand_words,"i")).test(S.first||"");
  kids.push(el("div",{cls:"q",text:isOut()&&!hand?D.r5.with_q:other?(hand?D.r4.hand_q:D.r4.show_q):c.q_who}));var helpers=Object.keys(D.helpers).map(function(k){return D.helpers[k];});if(other)helpers=helpers.filter(function(h){return h!==D.helpers.me;});if(ph)helpers=[ph].concat(helpers.filter(function(h){return h!==ph;}));
  kids.push(chips(helpers.concat([D.rules.every_list_has]),S.who,function(o){S.whoPicked=true;S.who=o===D.rules.every_list_has?(other?D.r4.someone:D.helpers.me):o;mk.disabled=!S.dateISO||!S.who;save();}));
  kids.push(mk,nav());return kids;};
function planData(){var p=P(),r=R(S.root),out=[];var s2=S.s2!=null?p.s2[S.s2]:null,s3=(s2&&S.s3!=null)?s2.s3[S.s3]:null;
  function add(h,t){if(t&&!isNotSure(t))out.push([h,t]);}
  add("What's driving me crazy",S.text1?'"'+S.text1+'"':p.label);if(!isOut()){add("What it looks like",s2&&s2.label);if(S.costs&&S.costs.length)add(D.cost.plan_label,S.costs.join("; "));add("What usually happens right before",s3&&s3.label);}
  var unc=S.root==="general"?(S.own||r.statement):(S.surface&&S.surface!==S.root?R(S.surface).statement+". Underneath that: "+lc(r.statement):r.statement);
  var dfn=signals().defensive||S.testMode;add(dfn?D.adapt.uncovered_label:"What I uncovered",unc);
  var ts=(S.theirSide||[]).filter(function(x){return !isNotSure(x);});if(ts.length)add("From their side, could be true",ts.join(". "));if(S.own&&S.root!=="general")add("In my own words",S.own);
  add("How I'll know it's fixed",S.fixed||(S.test&&S.test.watch)||"I'll notice it happening less");
  var po=profileOut();if(po&&po.out){var p=S.prof;out.push(["About this person",{profile:true,out:true,type:po.typeLabel,signs:realPicks(p.signs||[]),cls:po.C.label,how:[],today:[]}]);
    out.push(["How I'll open the talk",'"'+po.opener+'"']);}
  else if(po){var p=S.prof,rows=D.profile.dayone.delta.map(function(f){return f.label+": "+(p.delta[f.id]==="Same"?"same as day one":lc(p.delta[f.id])+" since day one");});
    out.push(["About this person",{profile:true,type:po.typeLabel,brought:(p.brought||[]).join(", "),then:p.then,now:p.now,rows:rows,changed:po.changed.map(function(f){return f.label+": "+lc(p.delta[f.id]);}),
      how:[].concat(realPicks(p.how.direction),realPicks(p.how.disagree),realPicks(p.how.driver),realPicks(p.how.expect)),today:realPicks(p.today),cls:po.C.label,note:p.type==="longtime"?D.profile.adds.longtime_note:null}]);
    if(po.listen){var Ls=D.profile.dayone.listen;out.push(["Listen first",Ls.step+'. Ask: "'+Ls.opener+'" '+Ls.note]);}
    out.push([po.listen?"Then, if needed":"How I'll open the talk",'"'+po.opener+'"'+(po.adds.length?" "+po.adds.join(". ")+".":"")]);}
  if(S.test)add("My one-week test","For one week: "+lc(S.test.try)+". Watching for: "+lc(S.test.watch)+". Check back "+nice(iso(addDays(7)))+".");
  var steps=[S.first].concat(S.acts.filter(function(a){return a!==S.first;}));if(S.test)steps=steps.filter(function(a){return a!==S.test.try;});if(S.mk&&S.mk.cash&&!isNotSure(S.mk.cash))add(D.flow2.cash_label,S.mk.cash);
  if(steps.length)out.push(["Steps I'm committing to",steps]);
  var tk=talkPlan();if(tk)out.push([tk.title,{talk:tk}]);else{var cs=callScript();if(cs)out.push([D.r3.call_title,cs]);}
  if(triage())add(D.r3.runway_label,D.r3.runway.replace("{w}","3"));
  if(S.mine){var mk=Object.keys(S.mine);if(mk.length)out.push([D.mine.label,mk.map(function(k){return S.mine[k].q+' "'+S.mine[k].t+'"';}).join("  ·  ")]);}
  var ll=lifeLine();if(ll)out.push([D.life.label,ll]);
  if(S.rb&&S.idea)add("If something gets in the way","If "+lc(D.roadblocks[S.rb].label)+", I'll "+lc(S.idea)+".");
  return out;}
function planText(full){var t=["My plan"," "+(styleV("intro")||TX(D.screens.plan.intro)),""];planData().forEach(function(x){if(!full&&x[1]&&(x[1].talk||x[1].profile))return;t.push(x[0]);if(x[1]&&x[1].talk){var k=x[1].talk;t.push(k.name,k.tip);if(k.traits.length)t.push("Day one: "+k.traits.join(", "));k.parts.forEach(function(p,i){t.push((i+1)+") "+p[0][0]+" ("+p[0][1]+"): "+p[1]);});t.push(D.profile.talk.dont_say+": "+k.dont.join(" / "),D.profile.talk.defensive_label+": "+k.defensive);}else if(x[1]&&x[1].profile){var q=x[1];t.push(q.type+(q.brought?". Brought on for: "+q.brought.toLowerCase():""),"Best at: day one "+(q.then||"-")+", today "+(q.now||"-"));q.changed.forEach(function(c){t.push("Changed since day one: "+c);});if(q.how.length)t.push("How they work: "+q.how.join(", "));if(q.today.length)t.push("Today, could be true: "+q.today.join(", ").toLowerCase());t.push("Looks like: "+q.cls);if(q.note)t.push(q.note);}else if(Array.isArray(x[1]))x[1].forEach(function(s,i){t.push((i+1)+". "+s+(i===0?" (When: "+nice(S.dateISO)+". Who: "+S.who+")":""));});else t.push(x[1]);t.push("");});
  if(S.checkin&&S.checkin!=="No thanks")t.push("When I'll look at this again: "+S.checkin.toLowerCase(),"");
  if(S.path==="wornout")t.push(D.safety_line.text,"");t.push("Perrone Strategic Systems");return t.join("\n");}
function icsAt(isoDate){var ds=isoDate.replace(/-/g,""),e=new Date(isoDate+"T12:00:00");e.setDate(e.getDate()+1);var es=iso(e).replace(/-/g,""),now=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+/,"");
  var body=(D.r2.ret_line.replace("{move}",S.first||"").replace("{date}",nice(S.dateISO||isoDate))+"\n"+location.origin+location.pathname+"?ck="+encodeURIComponent(S.planId||"")).replace(/\\/g,"\\\\").replace(/[,;]/g,function(m){return"\\"+m;}).replace(/\n/g,"\\n");
  var lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Perrone Strategic Systems//Plan//EN","BEGIN:VEVENT","UID:"+Date.now()+"@solve.joeperrone.biz","DTSTAMP:"+now,
    "DTSTART;VALUE=DATE:"+ds,"DTEND;VALUE=DATE:"+es,"SUMMARY:"+D.r2.cal_summary,"DESCRIPTION:"+body,"BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:"+D.r2.cal_summary,"TRIGGER:PT9H","END:VALARM","END:VEVENT","END:VCALENDAR"];
  var out=[];lines.forEach(function(l){while(l.length>74){out.push(l.slice(0,74));l=" "+l.slice(74);}out.push(l);});
  var blob=new Blob([out.join("\r\n")],{type:"text/calendar"}),a=el("a",{href:URL.createObjectURL(blob),download:"check-back.ics"});document.body.appendChild(a);a.click();a.remove();window.__lastIcs=out.join("\r\n");}
function ics(days){var d=addDays(days),ds=iso(d).replace(/-/g,""),e=addDays(days+1),es=iso(e).replace(/-/g,""),now=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+/,"");
  var body=planText(true).replace(/\\/g,"\\\\").replace(/[,;]/g,function(m){return"\\"+m;}).replace(/\n/g,"\\n");
  var lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Perrone Strategic Systems//Plan//EN","BEGIN:VEVENT","UID:"+Date.now()+"@solve.joeperrone.biz","DTSTAMP:"+now,
    "DTSTART;VALUE=DATE:"+ds,"DTEND;VALUE=DATE:"+es,"SUMMARY:Look at my plan again","DESCRIPTION:"+body,"BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:Look at my plan again","TRIGGER:PT9H","END:VALARM","END:VEVENT","END:VCALENDAR"];
  var out=[];lines.forEach(function(l){while(l.length>74){out.push(l.slice(0,74));l=" "+l.slice(74);}out.push(l);});
  var blob=new Blob([out.join("\r\n")],{type:"text/calendar"}),a=el("a",{href:URL.createObjectURL(blob),download:"my-plan-check-in.ics"});document.body.appendChild(a);a.click();a.remove();}
V.plan=function(){var F2=D.flow2,card=el("div",{cls:"plan"},[el("div",{cls:"planhead",text:styleV("intro")||D.screens.plan.intro,raw:styleV("intro")?"1":undefined})]);
  var cb=S.test?nice(iso(addDays(7))):null,lead=el("div",{cls:"lead"},[el("div",{cls:"leadwhen",text:nice(S.dateISO)}),el("div",{cls:"leadmove",text:S.first||""}),
    el("div",{cls:"leadmeta",text:F2.with+": "+(S.who||(S.prof&&S.prof.name)||D.helpers.me)+(cb?"  ·  "+F2.check+" "+cb:"")})]);
  if(S.test)lead.appendChild(el("div",{cls:"leadwatch",text:D.screens.test.watch_label+" "+lc(S.test.watch)}));card.appendChild(lead);
  var talkD=el("details",{cls:"talkd"},[el("summary",{text:F2.talk_more})]),whyD=el("details",{cls:"why"},[el("summary",{text:F2.why})]),hasTalk=false,hasWhy=false;
  planData().forEach(function(x){if(x[0]==="My one-week test")return;var T;if(x[1]&&x[1].talk){T=talkD;hasTalk=true;}else if(x[0]==="Steps I'm committing to"||x[0]===D.r3.call_title){T=card;}else{T=whyD;hasWhy=true;}
    if(x[0]==="Steps I'm committing to"&&Array.isArray(x[1])){var rest=x[1].filter(function(a){return a!==S.first;});if(!rest.length)return;x=["Also",rest];}
    if(!(x[1]&&x[1].talk))T.appendChild(el("h2",{text:x[0]}));
    if(x[1]&&x[1].talk){var k=x[1].talk,box=el("div",{cls:"talk"});box.appendChild(el("p",{cls:"meta",text:k.name+(k.traits.length?"   ·   Day one: "+k.traits.join(", ").toLowerCase():"")}));
      box.appendChild(el("p",{cls:"meta",text:k.tip}));var ol=el("ol",{cls:"parts"});
      k.parts.forEach(function(p){ol.appendChild(el("li",{},[el("strong",{text:p[0][0]}),el("span",{cls:"meta",text:" "+p[0][1]}),el("div",{text:p[1]})]));});box.appendChild(ol);
      box.appendChild(el("div",{cls:"glabel",text:D.profile.talk.dont_say}));var ul=el("ul");k.dont.forEach(function(d){ul.appendChild(el("li",{text:d}));});box.appendChild(ul);
      box.appendChild(el("div",{cls:"glabel",text:D.profile.talk.defensive_label}));box.appendChild(el("p",{text:k.defensive}));T.appendChild(box);}
    else if(x[1]&&x[1].profile&&x[1].out){var q=x[1],tb=el("div",{cls:"prof"});tb.appendChild(el("p",{text:(S.prof.label&&q.type.toLowerCase().indexOf(S.prof.label.toLowerCase())<0?capL(S.prof.label)+" · ":"")+q.type+"."}));
      if(q.signs.length)tb.appendChild(el("p",{text:D.r5.signs_label+": "+q.signs.join(" · ").toLowerCase()}));tb.appendChild(el("p",{cls:"cls",text:"Looks like: "+q.cls}));T.appendChild(tb);}
    else if(x[1]&&x[1].profile){var q=x[1],tb=el("div",{cls:"prof"});tb.appendChild(el("p",{text:(S.prof.label&&q.type.toLowerCase().indexOf(S.prof.label.toLowerCase())<0?capL(S.prof.label)+" · ":"")+q.type+(q.brought?". Brought on for: "+q.brought.toLowerCase():"")+"."}));if(q.today.length)tb.appendChild(el("p",{text:"Today, could be true: "+q.today.join(" · ").toLowerCase()}));
      var t=el("table",{cls:"dt"},[el("tr",{},[el("th",{text:""}),el("th",{text:"Day one"}),el("th",{text:"Today"})]),
        el("tr",{},[el("td",{text:"Best at"}),el("td",{text:q.then||"–"}),el("td",{text:q.now||"–"})])]);
      D.profile.dayone.delta.forEach(function(f){var v=S.prof.delta[f.id];t.appendChild(el("tr",{cls:v!=="Same"?"chg":""},[el("td",{text:f.label}),el("td",{text:f.then}),el("td",{text:v==="Same"?"Same":v})]));});
      tb.appendChild(t);if(q.how.length)tb.appendChild(el("p",{text:"How they work: "+q.how.join(" · ")}));tb.appendChild(el("p",{cls:"cls",text:"Looks like: "+q.cls}));
      if(q.note)tb.appendChild(el("p",{cls:"meta",text:q.note}));T.appendChild(tb);}
    else if(Array.isArray(x[1])){var ol=el("ol");x[1].forEach(function(s,i){var li=el("li",{},[s]);ol.appendChild(li);});T.appendChild(ol);}
    else T.appendChild(el("p",{text:x[1]}));});
  var nP=plans().filter(function(p){return p.id!==S.planId;}).length+1;if(nP>=3)card.appendChild(el("p",{cls:"meta",text:D.sell.fixes.replace("{n}",nP)}));
  if(hasTalk)card.appendChild(talkD);if(hasWhy)card.appendChild(whyD);
  var opt=el("div",{cls:"planopt noprint"});if(!(S.rb&&S.idea))opt.appendChild(el("button",{cls:"link",text:F2.plan_rb,on:function(){go("roadblock");}}));
  if(S.prof&&!isOut())opt.appendChild(el("button",{cls:"link",text:F2.plan_detail,on:function(){S.detail=1;go("fit");}}));card.appendChild(opt);
  var ck=el("div",{});if(S.checkin&&S.checkin!=="No thanks")ck.appendChild(el("p",{text:S.checkin}));
  var L=D.life;if(lifeOn())card.appendChild(el("div",{cls:"life noprint"},[el("div",{cls:"q",text:L.q}),el("p",{cls:"sub",text:L.sub}),chips(L.options,S.life,function(o){S.life=o;save();savePlan();render(false);})]));
  if(S.path==="wornout")card.appendChild(el("p",{cls:"care",text:D.safety_line.text}));
  card.appendChild(el("div",{cls:"printfoot",text:"Perrone Strategic Systems"}));
  var ckDate=S.test?iso(addDays(7)):(S.dateISO||iso(addDays(7)));
  var acts=el("div",{cls:"actions planacts noprint"},[
    el("button",{cls:"btn",text:D.r2.cal+" "+nice(ckDate),on:function(){icsAt(ckDate);savePlan();var p2=getPlan(S.planId);if(p2){p2.checkBy=ckDate;p2.cal=1;putPlan(p2);}toast(D.r2.cal_done.replace("{date}",nice(ckDate)));}}),
    el("div",{cls:"row3"},[
    el("button",{cls:"btn ghost",text:"Save as PDF",on:function(){window.print();}}),
    el("button",{cls:"btn ghost",text:"Copy",on:function(){var t=planText(S.inclPeople);(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){toast("Copied");},function(){toast("Copy not available here");});}}),
    el("button",{cls:"btn ghost",text:"Share plan",on:function(){var t=planText(S.inclPeople);if(navigator.share)navigator.share({title:"My plan",text:t}).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(t).then(function(){toast("Copied to share");});}})])]);
  var hasP=planData().some(function(x){return x[1]&&(x[1].talk||x[1].profile);});if(hasP){var cb=el("input",{type:"checkbox",id:"inclp"});cb.checked=!!S.inclPeople;cb.addEventListener("change",function(){S.inclPeople=cb.checked;save();});acts.appendChild(el("label",{cls:"inclp"},[cb,el("span",{text:D.privacy.include_people})]));}
  savePlan();var cont=el("div",{cls:"cont noprint planlinks"},[el("button",{cls:"link",text:D.cont.another,on:another}),el("button",{cls:"link sharetool",text:D.share.plan_button,on:shareOpen})]);
  var vb=null;if(S.vents&&S.vents.length){vb=el("details",{cls:"ventsaved noprint"},[el("summary",{text:D.vent.saved})]);
    S.vents.forEach(function(v){vb.appendChild(el("p",{cls:"venttext",raw:"1",text:v.text}));});
    vb.appendChild(el("button",{cls:"link",text:D.vent.delete,on:function(){S.vents=[];save();if(S.planId)savePlan();toast(D.vent.deleted);render(false);}}));}
  var fbw=fbWidget("plan",(S.planId||"p")+":plan",S.root,S.trade);
  return [el("h1",{text:D.screens.plan.heading}),card,acts,el("p",{cls:"privacy sold noprint",text:D.privacy.sold}),fbw,cont,vb];};
// ---------- saved plans + people (this device only) ----------
var KEYL="pss-plans-v1",KEYP="pss-people-v1";
function getJ(k,d){try{return JSON.parse(localStorage.getItem(k)||"null")||d;}catch(e){return d;}}
function setJ(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function plans(){return getJ(KEYL,[]);}
function people(){return getJ(KEYP,{});}
function getPlan(id){return plans().filter(function(p){return p.id===id;})[0]||null;}
function putPlan(p){var L=plans().filter(function(x){return x.id!==p.id;});L.unshift(p);setJ(KEYL,L.slice(0,50));}
function savePlan(){if(!S.planId)S.planId=Date.now().toString(36);var old=getPlan(S.planId)||{checks:[],ts:Date.now()};
  var snap=JSON.parse(JSON.stringify(S));snap.scr="plan";snap.hist=[];
  var r=R(S.root);putPlan({vision:old.vision&&old.vision.edited?old.vision:{line:visionLine(),picked:visionPicked(),was:S.text1||P().label,group:D.vision.path_group[S.path]||"self"},style:ownerStyle()||null,id:S.planId,ts:old.ts,title:S.root==="general"?(S.own||r.statement):r.statement,path:S.path,root:S.root,first:S.first,dateISO:S.dateISO,
    test:S.test,checkBy:old.checkBy||iso(addDays(7)),person:S.prof&&S.prof.label||null,text:planText(),snap:snap,checks:old.checks,
    surface:S.surface,ev:evLabels(),items:planItems(S.planId,old)});
  if(S.prof&&S.prof.label){var P0=people(),po=profileOut(),q=S.prof;var prev=P0[q.label]||{plans:[]};
    if(prev.plans.indexOf(S.planId)<0)prev.plans.push(S.planId);
    P0[q.label]={label:q.label,type:q.type,role:q.role||po.typeLabel,reports:q.reports||"",friction:(q.friction||[]).filter(function(x){return x!==D.team.friction_none;}),
      brought:realPicks(q.brought||[]),then:q.then||"",now:q.now||"",today:realPicks(q.today||[]),volume:(q.delta||{}).volume||"Same",cls:po.C.label,plans:prev.plans,ts:Date.now()};setJ(KEYP,P0);}
  save();}
function another(){var ai=S.ai,tr=S.trade;S=fresh();S.ai=ai;S.trade=tr;save();render(true);}
// ---------- money: know my numbers ----------
V.money=function(){var M=D.moneycheck,kids=[el("h1",{text:M.heading}),el("p",{cls:"sub",text:M.sub})];S.mk=S.mk||{know:null,follow:[]};
  var fbox=el("div",{});function fill(){fbox.innerHTML="";if(S.mk.know===M.strong){fbox.appendChild(el("div",{cls:"q",text:M.follow_q+" "+M.follow_sub}));
    fbox.appendChild(chipsMulti(M.follow,S.mk.follow,function(c){S.mk.follow=c;save();}));}}
  kids.push(chips(M.options,S.mk.know,function(o){S.mk.know=o;save();fill();}),fbox);fill();
  kids.push(el("div",{cls:"q",text:D.flow2.cash_q}),chips(D.flow2.cash,S.mk.cash,function(o){S.mk.cash=o;save();}));
  kids.push(el("button",{cls:"btn",text:"Next",on:function(){
    var fear=S.mk.cash===D.flow2.cash[3]&&(S.mk.know===M.strong||(S.mk.follow||[]).indexOf(M.follow[0])>=0||/enough/i.test(S.text1||""));if(fear||(S.mk.know===M.strong&&realPicks(S.mk.follow).length)){S.s3=null;S.ev=null;S.prof=null;S.notsure=false;S.inferred=[];setRoot(M.root,true);go("root");}else go("s3");}}),nav());
  return kids;};
// ---------- where they fit (team map) ----------
V.fit=function(){var T=D.team,p=S.prof,P0=people(),names=Object.keys(P0),kids=[el("h1",{text:T.fit_heading})],ext=p.type==="vendor"||p.type==="customer",PN=D.pname;
  var nm=el("input",{type:"text",placeholder:PN.placeholder,maxlength:"40","aria-label":PN.q,cls:"name",autocomplete:"off"});nm.value=p.name||"";nm.addEventListener("input",function(){p.name=nm.value.trim()||null;save();});
  kids.push(el("div",{cls:"q",text:PN.q}),nm,el("div",{cls:"q",text:PN.pron_q}),chips(PN.pron,p.pron||"they",function(o){p.pron=o;save();}));
  if(names.length){kids.push(el("div",{cls:"q",text:"Already on my map?"}),chips(names,p.label&&P0[p.label]?p.label:null,function(o){var x=P0[o];p.label=o;p.role=x.role;p.reports=x.reports;p.friction=x.friction.slice();save();render(false);}));}
  if(!ext){kids.push(el("div",{cls:"q",text:T.role_q}),chips(T.roles,p.role,function(o){p.role=o;save();}));
  kids.push(el("div",{cls:"q",text:T.reports_q}),chips(T.reports,p.reports,function(o){p.reports=o;save();}));}
  var others=[T.me].concat(names.filter(function(n){return n!==p.label;}));
  kids.push(el("div",{cls:"q",text:T.friction_q}),chipsMulti(others.concat([T.friction_none]),p.friction||[],function(c){p.friction=c;save();}));
  kids.push(el("button",{cls:"btn",text:"Next",on:function(){if(ext){p.role=p.role||D.profile.ask.options.filter(function(o){return o[0]===p.type;})[0][1].replace(/^An? /,"");p.reports="";}
      if(p.name&&!p.label){var nl=p.name,k2=1;while(P0[nl]&&nl!==p.label){k2++;nl=p.name+" "+k2;}p.label=nl;}
      if(!p.label){var base=p.role&&p.role!=="Other"?p.role:D.profile.ask.options.filter(function(o){return o[0]===p.type;})[0][1].replace(/^An? /,"");
      var n=1,lab=base;while(P0[lab]){n++;lab=base+" "+n;}p.label=lab;}save();go("dayone");}}),nav());return kids;};
V.pq=function(){var p=S.prof,PN=D.pname,P1=D.profile.dayone,kids=[el("h1",{text:D.flow2.pq_heading})];
  if(!isOut(p))P1.delta.forEach(function(f){p.delta[f.id]=p.delta[f.id]||P1.default;});
  var go1=el("button",{cls:"btn",text:D.r4.pq_skip});function filled(){return !!(p.name||realPicks(p.brought||[]).length||realPicks(p.today||[]).length||realPicks(p.signs||[]).length);}
  function relabel(){go1.textContent=filled()?D.r4.pq_next:D.r4.pq_skip;}
  var nm=el("input",{type:"text",placeholder:PN.placeholder,maxlength:"40","aria-label":PN.q,cls:"name",autocomplete:"off"});nm.value=p.name||"";nm.addEventListener("input",function(){p.name=nm.value.trim()||null;save();relabel();});
  if(isOut(p))kids.push(el("div",{cls:"q",text:PN.q}),nm,el("div",{cls:"q",text:D.r5.signs_q}),chipsMulti(D.r5.signs[p.type],p.signs||(p.signs=[]),function(c){p.signs=c;save();relabel();}));
  else kids.push(el("div",{cls:"q",text:PN.q}),nm,el("div",{cls:"q",text:P1.brought.q}),chipsMulti(P1.brought.options,p.brought,function(c){p.brought=c;save();relabel();}),
    el("div",{cls:"q",text:D.flow2.pq_today}),chipsMulti(P1.today.options,p.today||(p.today=[]),function(c){p.today=c;save();relabel();}));
  go1.addEventListener("click",function(){var P0=people();if(!p.label){var base=capL(p.name||D.profile.ask.options.filter(function(o){return o[0]===p.type;})[0][1].replace(/^An? /,"").replace(/\s*\(.*\)$/,""));var n=1,lab=base;while(P0[lab]){n++;lab=base+" "+n;}p.label=lab;}S.who=null;S.whoPicked=false;save();go("test");});
  relabel();kids.push(go1,nav());return kids;};
// ---------- check back ----------
V.checkback=function(){var C=D.cont,pl=getPlan(S.ckId);if(!pl)return [el("h1",{text:C.saved_empty}),el("button",{cls:"btn",text:C.another,on:another})];
  var ck=S.ck||(S.ck={did:null,noticed:null});var kids=[el("h1",{text:ck.fromRet&&ck.did?ck.did+".":C.ck_heading}),el("p",{cls:"sub",text:pl.title})];
  kids.push(el("div",{cls:"card test static"},[el("div",{cls:"try",text:pl.test?pl.test.try:pl.first}),el("div",{cls:"watch",text:pl.test?D.screens.test.watch_label+" "+pl.test.watch:"By "+nice(pl.dateISO||iso(new Date()))})]));
  var ckMsg=el("div",{cls:"ckmsg"}),fbBox=el("div",{cls:"fbbox"});function ckLine(){ckMsg.innerHTML="";if(ck.did&&!fbBox.firstChild){var sn=pl.snap||{};fbBox.appendChild(fbWidget("check-back",pl.id+":ck",sn.root,sn.trade));}if(ck.did===C.ck_opts[0])ckMsg.appendChild(el("p",{cls:"win",text:D.sell.ck_done}));
    else if(ck.did===C.ck_opts[2]||ck.did===C.ck_opts[3]){ckMsg.appendChild(el("p",{cls:"notyet",text:D.sell.ck_missed}));ckMsg.appendChild(el("button",{cls:"btn",text:D.sell.ck_smaller,on:function(){var p2=getPlan(S.ckId);var nd=iso(addDays(3));
      (p2.items||[]).forEach(function(i){if((i.kind==="first"||i.kind==="test")&&!i.done){i.due=nd;i.redate=1;i.dropped=false;}});p2.checks.push({ts:Date.now(),did:ck.did,next:"Smaller, in 3 days"});p2.checkBy=nd;p2.snoozeTo=nd;putPlan(p2);S.ck=null;toast(D.sell.ck_smaller_done);go("saved");}}));}}
  if(ck.fromRet&&ck.did){var ans=el("p",{cls:"answered"},[el("button",{cls:"link small",text:D.r3.ck_change,on:function(){ck.fromRet=0;save();render(false);}})]);kids.push(ans,ckMsg);}
  else kids.push(chips(C.ck_opts,ck.did,function(o){var was=ck.did;ck.did=o;save();if(notY(was)!==notY(o))render(false);else ckLine();}),ckMsg);ckLine();
  function notY(d){return d===C.ck_opts[2]||d===C.ck_opts[3];}var moreT=notY(ck.did)?el("details",{cls:"ckmore"},[el("summary",{text:D.r4.more})]):null;var KP=moreT?{push:function(){for(var i=0;i<arguments.length;i++)moreT.appendChild(arguments[i]);}}:kids;
  KP.push(el("div",{cls:"q",text:C.notice_q}),chips(C.notice_opts,ck.noticed,function(o){ck.noticed=o;save();}));
  KP.push(el("div",{cls:"q",text:C.next_q}),chips(C.next_opts,null,function(o){var p2=getPlan(S.ckId);p2.checks.push({ts:Date.now(),did:ck.did,noticed:ck.noticed,next:o});(p2.items||[]).forEach(function(i){if(i.kind==="check"&&!i.done)i.done=Date.now();if(i.kind==="test"&&ck.did==="Yes, done"&&!i.done)i.done=Date.now();});
    if(o===C.next_opts[0])(p2.items||[]).forEach(function(i){if(i.kind==="check"){i.done=null;i.due=iso(addDays(7));i.redate=1;}});
    if(o===C.next_opts[0]){p2.checkBy=iso(addDays(7));putPlan(p2);S.ck=null;toast(C.kept);go("saved");}
    else if(o===C.next_opts[1]){putPlan(p2);var ai=S.ai;S=JSON.parse(JSON.stringify(p2.snap));S.ai=ai;S.planId=p2.id;S.test=null;S.hist=[];S.scr="test";save();render(true);}
    else{putPlan(p2);another();}}));if(moreT)kids.push(moreT);
  if(pl.checks.length){kids.push(el("div",{cls:"glabel",text:C.history}));var ul=el("ul",{cls:"hist"});pl.checks.forEach(function(c){ul.appendChild(el("li",{text:new Date(c.ts).toLocaleDateString(undefined,{month:"short",day:"numeric"})+": "+[c.did,c.noticed,c.next].filter(Boolean).join(" · ")}));});kids.push(ul);}
  var det=el("details",{},[el("summary",{text:C.full}),el("pre",{cls:"plantext",text:pl.text})]);kids.push(det);
  kids.push(fbBox);
  kids.push(el("div",{cls:"actions noprint"},[el("button",{cls:"btn ghost",text:C.saved,on:function(){go("saved");}}),el("button",{cls:"btn ghost",text:C.team,on:function(){go("team");}})]),nav());return kids;};
V.saved=function(){var C=D.cont,L=plans(),kids=[el("h1",{text:C.saved}),el("p",{cls:"sub",text:C.saved_note})];
  if(!L.length)kids.push(el("p",{text:C.saved_empty}));
  else kids.push(cardList(L.map(function(p){var last=p.checks.length?p.checks[p.checks.length-1].did:"Check back "+nice(p.checkBy);return {label:p.title+" · "+last,id:p.id};}),function(it){S.ckId=it.id;S.ck=null;go("checkback");},{limit:8}));
  kids.push(el("div",{cls:"actions noprint"},[el("button",{cls:"btn",text:C.another,on:another}),el("button",{cls:"btn ghost",text:C.team,on:function(){go("team");}})]),nav());return kids;};
function teamFlags(P0,L){var T=D.team,f=[],ppl=Object.keys(P0).map(function(k){return P0[k];});
  ppl.forEach(function(p){if(p.volume==="Heavier"&&p.today.indexOf("Carrying more than before")>=0||p.today.indexOf("Carrying more than before")>=0&&ppl.length>1)f.push(T.flag_carry.replace("{who}",p.label));});
  var me=L.filter(function(p){return p.path==="doing"||T.carry_roots.indexOf(p.root)>=0;}).length;if(me>=2)f.push(T.flag_mecarry.replace("{n}",me));
  if(ppl.length>=2&&ppl.every(function(p){return p.reports==="Me";}))f.push(T.flag_allme);
  var nc=ppl.filter(function(p){return p.reports==="Not clear";}).length;if(nc)f.push(T.flag_notclear.replace("{n}",nc));
  var ho=L.filter(function(p){return T.handoff_roots.indexOf(p.root)>=0;}).length;if(ho>=2)f.push(T.flag_handoff.replace("{n}",ho));
  var cnt={};frictionLines(P0).forEach(function(l){l.forEach(function(n){cnt[n]=(cnt[n]||0)+1;});});Object.keys(cnt).forEach(function(n){if(cnt[n]>=2)f.push(T.flag_friction.replace("{who}",n).replace("{n}",cnt[n]));});
  return f.length?f:[T.flag_ok];}
function frictionLines(P0){var seen={},out=[];Object.keys(P0).forEach(function(k){(P0[k].friction||[]).forEach(function(o){var a=[k,o].sort(),key=a.join("|");if(!seen[key]){seen[key]=1;out.push(a);}});});return out;}
V.team=function(){var T=D.team,P0=people(),L=plans(),names=Object.keys(P0),kids=[el("h1",{text:T.heading}),el("p",{cls:"sub",text:T.sub})];
  if(!names.length){kids.push(el("p",{text:T.empty}),el("button",{cls:"btn",text:D.cont.another,on:another}),nav());return kids;}
  function node(label,sub){var li=el("li",{},[el("div",{cls:"onode"+(label===T.me?" me":"")},[el("strong",{text:label}),sub?el("span",{cls:"meta",text:" "+sub}):null].filter(Boolean))]);return li;}
  var root=el("ul",{cls:"org"}),meLi=node(T.me),kidsMe=el("ul");meLi.appendChild(kidsMe);root.appendChild(meLi);
  var leads=names.filter(function(n){return P0[n].role==="Lead or supervisor";});var leadUl=el("ul"),partnerUl=el("ul"),loose=[];
  names.forEach(function(n){var p=P0[n],li=node(n,p.role!==n?p.role:"");if(p.role==="Lead or supervisor"&&p.reports!=="The lead"){li.appendChild(leadUl);}
    if(p.reports==="Me"||p.role==="Lead or supervisor"&&p.reports!=="The lead")kidsMe.appendChild(li);else if(p.reports==="The lead")(leads.length?leadUl:kidsMe).appendChild(li);
    else if(p.reports==="My partner"){var pn=names.filter(function(x){return P0[x].type==="partner";})[0];(pn?partnerUl:kidsMe).appendChild(li);if(pn)partnerUl.dataset.p=pn;}else loose.push(li);});
  if(partnerUl.dataset.p){var pli=[].slice.call(root.querySelectorAll("li")).filter(function(li){return li.querySelector("strong").textContent===partnerUl.dataset.p;})[0];if(pli)pli.appendChild(partnerUl);}
  kids.push(root);if(loose.length){kids.push(el("div",{cls:"glabel",text:"Reports to: not clear"}));var lu=el("ul",{cls:"org"});loose.forEach(function(l){lu.appendChild(l);});kids.push(lu);}
  var t=el("table",{cls:"dt team"},[el("tr",{},T.cols.map(function(c){return el("th",{text:c});}))]);
  names.forEach(function(n){var p=P0[n];t.appendChild(el("tr",{},[n,p.role,p.reports||"–",(p.brought.join(", ")||"–")+(p.then?" · "+p.then:""),(p.today.join(", ")||"–")+(p.volume!=="Same"?" · workload "+p.volume.toLowerCase():""),p.cls].map(function(x){return el("td",{text:x});})));});
  kids.push(el("div",{cls:"tablewrap"},[t]));
  var fl=frictionLines(P0);if(fl.length){kids.push(el("div",{cls:"glabel",text:T.friction_label}));var fu=el("ul",{cls:"hist"});fl.forEach(function(l){fu.appendChild(el("li",{text:l[0]+"  ↔  "+l[1]}));});kids.push(fu);}
  kids.push(el("div",{cls:"glabel",text:T.flags_label}));var flu=el("ul",{cls:"flags"});teamFlags(P0,L).forEach(function(x){flu.appendChild(el("li",{text:x}));});kids.push(flu);
  kids.push(el("div",{cls:"actions noprint"},[el("button",{cls:"btn",text:D.cont.another,on:another}),el("button",{cls:"btn ghost",text:D.cont.saved,on:function(){go("saved");}}),el("button",{cls:"btn ghost",text:"Save as PDF",on:function(){window.print();}})]),nav());return kids;};
function lifeOn(){return S.path==="wornout"||(S.path==="money"&&S.root===D.moneycheck.root);}
function triage(){return S.path==="money"&&S.mk&&S.mk.cash===D.flow2.cash[0];}
function callScript(){var f=S.first||"";if(S.root===D.moneycheck.root)return null;if(!(new RegExp(D.r3.call_words,"i")).test(f))return null;var dt=nice(iso(addDays(14)));return D.r3.call_lines.map(function(l){return l.replace(/\{date\}/g,dt);});}
function needsOther(t){if(t===D.r3.solo_test.try)return false;return (new RegExp(D.r3.needs_other,"i")).test(t||"");}
function lifeLine(){var L=D.life;if(!lifeOn())return null;if(!S.life||!/^Yes/.test(S.life))return null;var k=S.root==="enough"?"enough":(S.prof&&(S.prof.today||[]).indexOf("Still hungry, but their vision drifted from ours")>=0?"vision":S.path);
  return (L.patterns[k]||L.patterns.off)+" "+L.step;}
function footLinks(){var f=document.getElementById("footlinks");if(!f)return;f.innerHTML="";if(!D||S.scr==="s1"&&!plans().length)return;var n=plans().length;
  if(n){var op=allItems().filter(function(i){return !i.done&&!i.dropped;}).length;f.appendChild(el("button",{cls:"link",text:D.commits.link+" ("+op+")",on:function(){go("commits");}}));
    f.appendChild(el("button",{cls:"link",text:D.cont.saved+" ("+n+")",on:function(){go("saved");}}));f.appendChild(el("button",{cls:"link",text:D.self.link,on:function(){go("me");}}));f.appendChild(el("button",{cls:"link",text:D.vision.link,on:function(){go("vision");}}));}if(Object.keys(people()).length)f.appendChild(el("button",{cls:"link",text:D.cont.team,on:function(){go("team");}}));}

// ---------- commitments + self-profile ----------
function today(){return iso(addDays(0));}
function planItems(pid,old){var C=D.commits,K=C.kinds,items=[],who=S.prof&&S.prof.name?S.prof.name:(S.prof&&S.prof.label?S.prof.label.toLowerCase():"them");var r=R(S.root);
  if(S.first)items.push({id:pid+"-first",kind:"first",text:S.first,due:S.dateISO});
  if(S.test)items.push({id:pid+"-test",kind:"test",text:"For one week: "+lc(S.test.try),due:old.checkBy||iso(addDays(7))});
  var po=profileOut();if(po&&po.listen)items.push({id:pid+"-listen",kind:"listen",text:C.listen_text.replace("{who}",who),due:S.dateISO});
  if(talkPlan())items.push({id:pid+"-talk",kind:"talk",text:C.talk_text.replace("{who}",who),due:S.dateISO});
  items.push({id:pid+"-check",kind:"check",text:C.check_text.replace("{title}",lc(S.root==="general"?(S.own||r.statement):r.statement)),due:old.checkBy||iso(addDays(7))});
  var prev={};(old.items||[]).forEach(function(i){prev[i.id]=i;});
  return items.map(function(i){var p=prev[i.id];if(p){i.done=p.done||null;i.dropped=p.dropped||null;if(p.redate)i.due=p.due,i.redate=1;}return i;});}
function evLabels(){var out=[];if(S.ev&&S.path&&EV()){var E=EV();S.ev.forEach(function(v,qi){if(v!=null&&v>=0)out.push(E.questions[qi].options[v].label);});}return out;}
function allItems(){var out=[];plans().forEach(function(p){(p.items||[]).forEach(function(i){i.pid=p.id;out.push(i);});});return out;}
function setItem(pid,id,fn){var p=getPlan(pid);if(!p)return;p.items.forEach(function(i){if(i.id===id)fn(i);});putPlan(p);}
function icsItem(title,isoD,desc,fname){var ds=isoD.replace(/-/g,""),p=isoD.split("-"),e=new Date(+p[0],+p[1]-1,+p[2]+1,12),es=iso(e).replace(/-/g,""),now=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+/,"");
  var esc=function(x){return x.replace(/\\/g,"\\\\").replace(/[,;]/g,function(m){return"\\"+m;}).replace(/\n/g,"\\n");};
  var lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Perrone Strategic Systems//Plan//EN","BEGIN:VEVENT","UID:"+Date.now()+Math.random().toString(36).slice(2,6)+"@solve.joeperrone.biz","DTSTAMP:"+now,
    "DTSTART;VALUE=DATE:"+ds,"DTEND;VALUE=DATE:"+es,"SUMMARY:"+esc(title),"DESCRIPTION:"+esc(desc),"BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:"+esc(title),"TRIGGER:PT9H","END:VALARM","END:VEVENT","END:VCALENDAR"];
  var out=[];lines.forEach(function(l){while(l.length>74){out.push(l.slice(0,74));l=" "+l.slice(74);}out.push(l);});
  var blob=new Blob([out.join("\r\n")],{type:"text/calendar"}),a=el("a",{href:URL.createObjectURL(blob),download:fname||"commitment.ics"});document.body.appendChild(a);a.click();a.remove();}
V.commits=function(){var C=D.commits,its=allItems(),t=today(),kids=[el("h1",{text:C.heading}),el("p",{cls:"sub",text:C.sub})];
  if(!its.length){kids.push(el("p",{text:C.empty}),nav());return kids;}
  var open=its.filter(function(i){return !i.done&&!i.dropped;}).sort(function(a,b){return (a.due||"").localeCompare(b.due||"");}),done=its.filter(function(i){return i.done||i.dropped;});
  function row(i){var over=!i.done&&!i.dropped&&i.due&&i.due<t;var box=el("div",{cls:"citem"+(i.done?" done":"")+(i.dropped?" dropped":"")+(over?" over":"")});
    var chk=el("button",{cls:"cbox","aria-label":C.mark,"aria-pressed":i.done?"true":"false",text:i.done?"✓":""});chk.addEventListener("click",function(){setItem(i.pid,i.id,function(x){x.done=x.done?null:Date.now();x.dropped=null;});render(false);});
    var body=el("div",{cls:"cbody"},[el("div",{cls:"ckind",text:C.kinds[i.kind]}),el("div",{cls:"ctext",text:i.text}),el("div",{cls:"meta",text:i.dropped?C.let_go_label:C.due.replace("{date}",nice(i.due||t))})]);
    if(over){body.appendChild(el("p",{cls:"gentle",text:C.overdue}));body.appendChild(el("div",{cls:"row"},[el("button",{cls:"chip",text:C.redate,on:function(){setItem(i.pid,i.id,function(x){x.due=iso(addDays(3));x.redate=1;});render(false);}}),
      el("button",{cls:"chip",text:C.letgo,on:function(){setItem(i.pid,i.id,function(x){x.dropped=Date.now();});render(false);}})]));}
    if(i.dropped)body.appendChild(el("button",{cls:"link",text:C.undo,on:function(){setItem(i.pid,i.id,function(x){x.dropped=null;});render(false);}}));
    if(!i.done&&!i.dropped)body.appendChild(el("button",{cls:"link",text:C.ics,on:function(){icsItem(C.kinds[i.kind]+": "+i.text,i.due||t,i.text+"\n\nPerrone Strategic Systems","commitment-"+i.kind+".ics");}}));
    box.appendChild(chk);box.appendChild(body);return box;}
  kids.push(el("div",{cls:"glabel",text:C.open+" ("+open.length+")"}));open.forEach(function(i){kids.push(row(i));});
  if(done.length){kids.push(el("div",{cls:"glabel",text:C.done+" ("+done.length+")"}));done.forEach(function(i){kids.push(row(i));});}
  kids.push(el("div",{cls:"actions noprint"},[el("button",{cls:"btn ghost",text:D.self.link,on:function(){go("me");}}),el("button",{cls:"btn ghost",text:D.cont.another,on:another})]),nav());return kids;};
function selfProfile(){var SF=D.self,L=plans(),its=allItems(),t=today(),pats=[],fol=[];
  SF.rules.forEach(function(r){var n=L.filter(function(p){return (p.ev||[]).some(function(e){return (r.ev||[]).indexOf(e)>=0;})||(r.roots||[]).indexOf(p.root)>=0||(r.roots||[]).indexOf(p.surface)>=0;}).length;if(n>=2)pats.push({text:r.text,n:n});});
  pats.sort(function(a,b){return b.n-a.n;});
  Object.keys(SF.kind_plural).forEach(function(k){var mine=its.filter(function(i){return i.kind===k;}),kept=mine.filter(function(i){return i.done;}).length,
    missed=mine.filter(function(i){return i.dropped||(!i.done&&i.due&&i.due<t);}).length,kp=SF.kind_plural[k],Kp=kp.charAt(0).toUpperCase()+kp.slice(1);
    if(kept>=2&&kept>missed)fol.push(SF.kept.replace("{kind}",kp));else if(missed>=2&&missed>kept)fol.push(SF.slips.replace("{kind}",Kp));else if(kept&&missed)fol.push(SF.mixed.replace("{kind}",Kp));});
  return {pats:pats,fol:fol,p:L.length,c:its.length};}
V.me=function(){var SF=D.self,sp=selfProfile(),kids=[el("h1",{text:SF.heading}),el("p",{cls:"sub",text:SF.sub})];
  kids.push(el("p",{cls:"meta",text:SF.basis.replace("{p}",sp.p).replace("{c}",sp.c)}));
  if(!sp.pats.length&&!sp.fol.length)kids.push(el("p",{text:SF.early}));
  if(sp.pats.length){kids.push(el("div",{cls:"glabel",text:SF.patterns_label}));var u=el("ul",{cls:"mirror"});sp.pats.forEach(function(x){u.appendChild(el("li",{text:x.text+" ("+x.n+" plans)"}));});kids.push(u);}
  if(sp.fol.length){kids.push(el("div",{cls:"glabel",text:SF.follow_label}));var u2=el("ul",{cls:"mirror"});sp.fol.forEach(function(x){u2.appendChild(el("li",{text:x}));});kids.push(u2);}
  var H=learn(),lr=[];Object.keys(H.rootN).filter(function(k){return H.rootN[k]>=2;}).sort(function(a,b){return H.rootN[b]-H.rootN[a];}).slice(0,2).forEach(function(k){lr.push(SF.repeat_root.replace("{root}",R(k).statement).replace("{n}",H.rootN[k]));});
  var ks=Object.keys(H.kind).filter(function(k){var x=H.kind[k];return x.kept+x.missed>=2&&SF.kind_plural[k];});
  if(ks.length){var rate=function(k){var x=H.kind[k];return x.kept/(x.kept+x.missed);};ks.sort(function(a,b){return rate(b)-rate(a);});
    if(rate(ks[0])>0.5)lr.push(SF.finish_most.replace("{kind}",SF.kind_plural[ks[0]]));var lo=ks[ks.length-1];if(ks.length>1&&rate(lo)<0.5)lr.push(SF.finish_least.replace("{kind}",SF.kind_plural[lo]));}
  if(H.kind.test&&H.kind.test.kept+H.kind.test.missed)lr.push(SF.test_kept.replace("{k}",H.kind.test.kept).replace("{n}",H.kind.test.kept+H.kind.test.missed));
  if(lr.length){kids.push(el("div",{cls:"glabel",text:SF.learn_label}));var u3=el("ul",{cls:"mirror learned"});lr.forEach(function(x){u3.appendChild(el("li",{text:x}));});kids.push(u3);kids.push(el("p",{cls:"meta",text:SF.adapts}));}
  kids.push(el("p",{cls:"meta",text:SF.note}));
  kids.push(el("div",{cls:"actions noprint"},[el("button",{cls:"btn ghost",text:D.commits.link,on:function(){go("commits");}}),el("button",{cls:"btn ghost",text:D.cont.team,on:function(){go("team");}})]),nav());return kids;};

// ---------- trade, vocabulary, tone ----------
function toneKey(){var o=S&&S.trade&&D.trade.options.filter(function(x){return x[0]===S.trade;})[0];return o?o[2]:"generic";}
function toneSwap(t){var sw=(D.tone[toneKey()]||D.tone.generic).swap;return sw[t]||t;}
function vocabSwap(t){if(!S||!S.trade)return t;var m=D.trade.vocab[S.trade]||D.trade.vocab.other;
  return t.split(/("[^"]*")/).map(function(seg){if(seg.charAt(0)==='"')return seg;
    return seg.replace(/\b(re-dos|re-do|jobs|job|quotes|quote|customers|customer|techs|tech|crew|shop|foreman)\b/gi,function(w){var r=m[w.toLowerCase()];if(!r)return w;return w.charAt(0)===w.charAt(0).toUpperCase()?r.charAt(0).toUpperCase()+r.slice(1):r;});}).join("");}
function TX(t){if(!D||!S||S.scr==="s1"||typeof t!=="string")return t;return vocabSwap(toneSwap(t));}
V.trade=function(){var T=D.trade,items=T.options.map(function(o){return {label:o[1],k:o[0]};});
  return [el("h1",{text:T.heading}),el("p",{cls:"sub",text:T.sub}),cardList(items,function(it){S.trade=it.k;var n=S.tradeNext||"s2";S.tradeNext=null;go(n);},{limit:12}),nav()];};
function echoLine(){if(!S.text1)return null;var t=S.text1.length>90?S.text1.slice(0,88)+"…":S.text1;return el("p",{cls:"echo",raw:"1",text:D.trade.echo+' "'+t+'"'});}
function normalLine(){var b=D.trade.biz[S.trade||"other"]||D.trade.biz.other;return el("p",{cls:"normal",raw:"1",text:D.trade.normal.replace("{biz}",b)});}
function mineWidget(noneEl){var M=D.mine,wrap=el("div",{cls:"mine"}),open=el("button",{cls:"link mine-open",text:M.button});
  open.addEventListener("click",function(){open.remove();var ta=el("textarea",{rows:"2",placeholder:M.placeholder,maxlength:"300","aria-label":M.button});
    var go1=el("button",{cls:"btn",text:M.go});go1.disabled=true;ta.addEventListener("input",function(){go1.disabled=!ta.value.trim();});
    var m=micFor(ta,function(v){ta.value=v;go1.disabled=!v.trim();});
    go1.addEventListener("click",function(){var v=ta.value.trim();if(!v)return;var h=app.querySelector("h1");S.mine=S.mine||{};S.mine[S.scr]={q:h?h.textContent:"",t:v};save();noneEl.click();});
    wrap.appendChild(ta);if(m)wrap.appendChild(m);wrap.appendChild(go1);ta.focus();});
  wrap.appendChild(open);return wrap;}

// ---------- adaptive tone: defensiveness + owner style (local keywords; AI not needed) ----------
function allText(){var a=[S.text1,S.own];if(S.mine)Object.keys(S.mine).forEach(function(k){a.push(S.mine[k].t);});(S.vents||[]).forEach(function(v){a.push(v.text);});return norm(a.filter(Boolean).join(" . "));}
function signals(){var A=D.adapt,t=allText(),sc=0,hits=[];
  A.def_words.forEach(function(w){if(new RegExp("\\b"+w+"\\b").test(t)){sc++;hits.push(w);}});
  var pf=0;A.profanity.forEach(function(w){var m=t.match(new RegExp("\\b"+w+"\\w*","g"));if(m)pf+=m.length;});if(pf>=2)sc++;if(pf>=4)sc++;
  if(S.path==="people"&&S.s2!=null&&S.s2<5&&S.s3!=null){var c=P().s2[S.s2].s3[S.s3];if(c&&isNotSure(c.label)){sc++;hits.push("tap:skip-process");}}
  sc+=Math.min(2,S.rejects||0);if(S.ev&&S.ev.length&&S.ev.every(function(v){return v===-1||v===null;}))sc++;
  return {defensive:sc>=A.threshold,score:sc,hits:hits,prof:pf};}
function ownerStyle(){var A=D.adapt,t=allText(),best=null,bs=0,sig=signals();
  Object.keys(A.styles).forEach(function(k){var s=0;A.styles[k].words.forEach(function(w){if(t.indexOf(norm(w).trim())>=0)s++;});
    if(k==="worn"&&S.path==="wornout")s+=2;if(k==="numbers"&&S.mk&&S.mk.know===D.moneycheck.strong)s+=2;if(k==="pleaser"&&(S.root==="sayyes"||S.surface==="sayyes"))s+=2;
    if(k==="headstrong"&&(S.rejects||0)>=2)s+=2;if(k==="veteran"&&S.prof&&S.prof.type==="longtime")s+=0;
    if(s>bs){bs=s;best=k;}});return best;}
function styleV(key){var st=ownerStyle()||learn().style;return st&&D.adapt.styles[st][key]||null;}
function ackLine(){var sig=signals();if(!sig.defensive)return null;if(!S.ackAt)S.ackAt=S.scr;if(S.ackAt!==S.scr)return null;
  var A=D.adapt.ack;return el("p",{cls:"ack",text:A[(S.text1||"").length%A.length]});}
// ---------- let it rip ----------
function ventOpen(){if(document.getElementById("vent"))return;var Vt=D.vent,ov=el("div",{id:"vent",cls:"vent",role:"dialog","aria-label":Vt.heading});
  var ta=el("textarea",{rows:"10",placeholder:Vt.placeholder,"aria-label":Vt.heading,maxlength:"5000"});
  var m=micFor(ta,function(v){ta.value=v;});
  var done=el("button",{cls:"btn",text:Vt.done}),close=el("button",{cls:"link",text:Vt.close,on:function(){ov.remove();}});
  done.addEventListener("click",function(){var v=ta.value.trim();var mb=m&&m.querySelector(".mic");if(mb&&mb.classList.contains("live"))mb.click();if(!v){ov.remove();return;}ventApply(v);
    var sig=signals();ov.innerHTML="";ov.appendChild(el("p",{cls:"ventack",text:sig.defensive?Vt.ack_def:Vt.ack}));
    setTimeout(function(){ov.classList.add("out");setTimeout(function(){ov.remove();ventNext();},matchMedia("(prefers-reduced-motion: reduce)").matches?0:300);},900);});
  [el("h1",{text:Vt.heading}),el("p",{cls:"sub",text:Vt.sub}),ta,m,done,close].forEach(function(k){if(k)ov.appendChild(k);});
  document.body.appendChild(ov);ta.focus();if(m&&SR)setTimeout(function(){try{var mb=m.querySelector(".mic");if(mb&&!mb.classList.contains("live"))mb.click();}catch(e){}},250);}
function ventApply(v){S.vents=S.vents||[];S.vents.push({ts:Date.now(),scr:S.scr,text:v});var t=norm(v);
  if(!S.trade){var tw=D.vent.trade_words;Object.keys(tw).some(function(k){if(tw[k].some(function(w){return t.indexOf(w)>=0;})){S.trade=k;return true;}return false;});}
  var r=route(v);if(r.path){S.ventPath=r.path;S.ventCards=r.cards||[];
    if(S.path===r.path&&S.s2==null&&r.cards&&r.cards.length)S.s2order=orderFrom(r.cards,P().s2.length);}
  if(S.planId)savePlan();save();}
function ventNext(){if(S.scr==="s1"&&S.ventPath&&D.paths[S.ventPath]){var last=S.vents[S.vents.length-1];S.text1=(last&&last.text||"").slice(0,200);pickPath(S.ventPath,S.ventCards||[]);return;}render(false);}
function ventFab(){var b=document.getElementById("ventfab");if(!b){b=el("button",{id:"ventfab",cls:"ventfab noprint",text:D.vent.button,on:ventOpen});(document.getElementById("ventslot")||document.body).appendChild(b);}}

// ---------- share (owner sends from own device; never auto-sent) + privacy ----------
function shareProblem(){var t=(S.text1||"").trim().replace(/[.!?\s]+$/,"");if(t&&t.length<=80)return t.charAt(0).toLowerCase()+t.slice(1);var P2=D.share.problem;return P2[S.path]||P2.general;}
function shareOpen(){if(document.getElementById("share"))return;var H=D.share,vi=0,nm="";var ov=el("div",{id:"share",cls:"vent share",role:"dialog","aria-label":H.heading});
  var ta=el("textarea",{rows:"6","aria-label":"Note",maxlength:"600"}),sub=el("input",{cls:"name",type:"text","aria-label":"Subject",maxlength:"80"});
  var name=el("input",{cls:"name",type:"text",placeholder:H.name_ph,"aria-label":H.name_label,maxlength:"30"});
  var sms=el("a",{cls:"btn ghost",text:H.btn_text}),mail=el("a",{cls:"btn ghost",text:H.btn_email});
  function fill(){var v=H.variants[vi];ta.value=v.body.replace("{name}",nm||H.name_fallback).replace("{problem}",shareProblem()).replace("{link}",H.link_short);sub.value=v.subject;links();}
  function links(){sms.href="sms:?&body="+encodeURIComponent(ta.value);mail.href="mailto:?subject="+encodeURIComponent(sub.value)+"&body="+encodeURIComponent(ta.value);}
  ta.addEventListener("input",links);sub.addEventListener("input",links);name.addEventListener("input",function(){var old=nm||H.name_fallback;nm=name.value.trim();ta.value=ta.value.replace("Hey "+old+",","Hey "+(nm||H.name_fallback)+",");links();});
  var vrow=el("div",{cls:"row"});H.variants.forEach(function(v,i){var c=el("button",{cls:"chip"+(i===0?" on":""),raw:"1",text:v.label});c.addEventListener("click",function(){vi=i;vrow.querySelectorAll(".chip").forEach(function(x){x.classList.remove("on");});c.classList.add("on");fill();});vrow.appendChild(c);});
  var btns=el("div",{cls:"sharebtns"});
  if(navigator.share)btns.appendChild(el("button",{cls:"btn",text:H.btn_share,on:function(){navigator.share({title:sub.value,text:ta.value.replace(H.link_short,""),url:H.link}).catch(function(){});}}));
  btns.appendChild(sms);btns.appendChild(mail);
  btns.appendChild(el("button",{cls:"btn ghost",text:H.btn_copy,on:function(){var t=ta.value;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){toast(H.copied);},function(){ta.select();try{document.execCommand("copy");toast(H.copied);}catch(e){}});}}));
  [el("h1",{raw:"1",text:H.heading}),el("p",{cls:"sub",text:H.sub}),el("div",{cls:"q",text:H.variants_label}),vrow,name,sub,ta,btns,el("p",{cls:"privacy",text:D.privacy.share_note}),
   el("button",{cls:"link",text:H.close,on:function(){ov.remove();}})].forEach(function(k){ov.appendChild(k);});
  document.body.appendChild(ov);fill();}
function deleteAll(){if(!confirm(D.privacy.confirm))return;Object.keys(localStorage).filter(function(k){return /^pss-/.test(k);}).forEach(function(k){localStorage.removeItem(k);});
  S=fresh();render(true);toast(D.privacy.deleted);}
function footExtras(){var f=document.getElementById("footx");if(!f){f=el("div",{id:"footx",cls:"footx noprint"});var ft=document.querySelector("footer.foot");ft.parentNode.insertBefore(f,ft);}
  f.innerHTML="";f.appendChild(el("button",{cls:"link quietshare",raw:"1",text:D.share.quiet,on:shareOpen}));f.appendChild(el("button",{cls:"link quietprice",raw:"1",text:D.pricing.link,on:function(){go("pricing");}}));
  if(S.scr!=="s1"&&S.scr!=="plan")f.appendChild(el("p",{cls:"privacy",text:D.privacy.note}));if(S.scr!=="s1"&&S.scr!=="trade")f.appendChild(tradeChip());f.appendChild(el("button",{cls:"link delall",text:D.privacy.delete,on:deleteAll}));}
function detectTrade(t){t=norm(t);var tw=D.vent.trade_words,hit=null;Object.keys(tw).some(function(k){if(tw[k].some(function(w){return t.indexOf(w)>=0;})){hit=k;return true;}return false;});return hit;}

// ---------- on-device learning (never leaves localStorage) ----------
function learn(){var L=plans(),its=allItems(),t=today(),rootN={},kind={},act={},testK={};
  L.forEach(function(p){if(p.root&&p.root!=="general")rootN[p.root]=(rootN[p.root]||0)+1;});
  its.forEach(function(i){var k=kind[i.kind]=kind[i.kind]||{kept:0,missed:0};var miss=i.dropped||(!i.done&&i.due&&i.due<t);if(i.done)k.kept++;else if(miss)k.missed++;
    var key=(i.text||"").replace(/^For one week: /,"").toLowerCase();var a=act[key]=act[key]||0;act[key]=a+(i.done?1:miss?-1:0);});
  var tr=null,st=null;L.some(function(p){if(!tr&&p.snap&&p.snap.trade)tr=p.snap.trade;if(!st&&p.style)st=p.style;return tr&&st;});
  return {n:L.length,rootN:rootN,kind:kind,act:act,trade:tr,style:st};}
function actScore(a,H){return H.act[(a||"").toLowerCase()]||0;}
function learnSort(list,get,H){H=H||learn();if(!H.n)return list;return list.map(function(x,i){return {x:x,i:i,s:get(x,H)};}).sort(function(a,b){return b.s-a.s||a.i-b.i;}).map(function(o){return o.x;});}
function scrub(t){var names=[];try{Object.keys(people()).forEach(function(k){names.push(k);var p=people()[k];if(p&&p.name)names.push(p.name);});}catch(e){}
  if(S.prof&&S.prof.name)names.push(S.prof.name);
  t=String(t).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g,"[email]").replace(/https?:\/\/\S+/g,"[link]").replace(/\+?\d[\d\s().-]{6,}\d/g,"[number]");
  names.filter(function(n){return n&&n.length>1&&!/^(an?|the|my)\b/i.test(n);}).forEach(function(n){t=t.replace(new RegExp("\\b"+n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","gi"),"[name]");});
  return t;}

// ---------- pricing (placeholder; checkout NOT live; monthly only) ----------
var LOCKS=false; // flip to true only when X Money checkout is live. Free tier then shows save/history/reminders/team map locked.
var LOCKED={saved:1,checkback:1,commits:1,team:1};
V.pricing=function(){var Pz=D.pricing,box=el("div",{cls:"tiers"}),N=getJ("pss-notify-v1",{tiers:[]}),live=Pz.live||[];
  Pz.tiers.forEach(function(t){if(t.hidden)return;var c=el("div",{cls:"tier"+(t.badge?" best":"")});
    if(t.badge)c.appendChild(el("div",{cls:"badge",raw:"1",text:Pz.badge}));
    c.appendChild(el("div",{cls:"tname",raw:"1",text:t.name}));c.appendChild(el("div",{cls:"tprice",raw:"1",text:"$"+t.price+(t.price?Pz.per:"")}));
    var u=el("ul",{});t.items.forEach(function(i){u.appendChild(el("li",{raw:"1",text:i}));});c.appendChild(u);
    if(t.price){if(live.indexOf(t.id)>=0)c.appendChild(el("p",{cls:"soon",raw:"1",text:Pz.live_now.replace("{t}",t.name)}));else c.appendChild(el("p",{cls:"soon",raw:"1",text:Pz.soon}));
      var on=N.tiers.indexOf(t.id)>=0;var nb=el("button",{cls:"btn ghost notify"+(on?" on":""),type:"button",raw:"1",text:on?Pz.notified_on:Pz.notify,on:function(){var n=getJ("pss-notify-v1",{tiers:[]});if(n.tiers.indexOf(t.id)<0)n.tiers.push(t.id);n.ts=Date.now();setJ("pss-notify-v1",n);toast(Pz.notified);render(false);}});
      if(on)nb.disabled=true;c.appendChild(el("div",{cls:"paypair"},[nb,el("button",{cls:"btn ghost",text:D.sell.not_now,on:function(){back();}})]));}
    else c.appendChild(el("button",{cls:"btn ghost",raw:"1",text:Pz.free_cta,on:function(){back();}}));
    box.appendChild(c);});
  var st=RCPT.msg?el("p",{cls:"soon rstat",raw:"1",text:RCPT.msg}):null,rl=PAY_LIVE?el("button",{cls:"link",text:D.r3.restore_link,on:function(){go("restore");}}):null;
  return [el("h1",{raw:"1",text:Pz.heading}),el("p",{cls:"sub",raw:"1",text:Pz.sub}),st,el("p",{cls:"invest",text:D.sell.invest}),box,rl,nav()];};
// ---------- X Money receipt check (on this phone only). OFF until paid plans go live ----------
var PAY_LIVE=false;
var FEEDBACK_TO='joeperrone@mail.grokbot.com'; // CONFIRM WITH JOE before launch (NOTES.md) // flip to true only when X Money checkout is live and Joe signs off
var RCPT_KEY={"kty":"EC","crv":"P-256","x":"_4wKq9tTN_tAjm-mb-kuSnZG53miJTabNBYIMjw8T0U","y":"FRxsdTSOh9dxXal30YnvslKMNSktUWHFZpkZjLBAPM8"}; // public key only; DEV key, rotate before launch
var RCPT={tier:null,exp:null,msg:null};
function b64u(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
function checkReceipt(tok){tok=(tok||"").trim();var pt=tok.split(".");if(pt.length!==3||pt[0]!=="PSS1"||!window.crypto||!crypto.subtle)return Promise.resolve(null);
  var pay;try{pay=JSON.parse(new TextDecoder().decode(b64u(pt[1])));}catch(e){return Promise.resolve(null);}
  return crypto.subtle.importKey("jwk",RCPT_KEY,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]).then(function(k){
    return crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},k,b64u(pt[2]),new TextEncoder().encode(pt[0]+"."+pt[1]));}).then(function(ok){if(!(ok&&pay&&pay.tier&&/^\d{4}-\d\d-\d\d$/.test(pay.exp||"")))return null;if((D.pricing.revoked||[]).indexOf(pay.id)>=0)pay.__rev=1;return pay;}).catch(function(){return null;});}
function tierName(id){var t=D.pricing.tiers.filter(function(x){return x.id===id;})[0];return t?t.name:id;}
function applyReceipt(pay,tok){var Q=D.r3;if(!pay){RCPT={tier:null,exp:null,msg:null};return false;}
  if(pay.__rev){RCPT={tier:null,exp:null,msg:Q.restore_revoked};try{localStorage.removeItem("pss-receipt-v1");}catch(e){}return false;}
  if(pay.exp<today()){RCPT={tier:null,exp:pay.exp,msg:Q.restore_expired.replace("{t}",tierName(pay.tier)).replace("{date}",nice(pay.exp))};try{localStorage.removeItem("pss-receipt-v1");}catch(e){}return false;}
  RCPT={tier:pay.tier,exp:pay.exp,msg:Q.restore_ok.replace("{t}",tierName(pay.tier)).replace("{date}",nice(pay.exp))};if(tok){try{localStorage.setItem("pss-receipt-v1",tok);}catch(e){}}return true;}
function receiptBoot(){if(!PAY_LIVE)return Promise.resolve();var tok=localStorage.getItem("pss-receipt-v1");if(!tok)return Promise.resolve();return checkReceipt(tok).then(function(p){applyReceipt(p,null);});}
window.__pssTier=function(){return PAY_LIVE&&RCPT.tier?RCPT.tier:"free";};
V.restore=function(){var Q=D.r3,ta=el("textarea",{rows:"4",placeholder:Q.restore_ph,"aria-label":Q.restore_h,maxlength:"2000"}),out=el("p",{cls:"rstat",raw:"1",text:PAY_LIVE?(RCPT.msg||""):Q.restore_off});
  var b=el("button",{cls:"btn",text:Q.restore_btn,on:function(){if(!PAY_LIVE){out.textContent=Q.restore_off;return;}checkReceipt(ta.value).then(function(p){if(!p){out.textContent=Q.restore_bad;return;}if(p.__rev){applyReceipt(p,null);out.textContent=Q.restore_revoked;return;}applyReceipt(p,ta.value.trim());out.textContent=RCPT.msg;});}});
  return [el("h1",{raw:"1",text:Q.restore_h}),el("p",{cls:"sub",raw:"1",text:Q.restore_sub}),ta,b,out,nav()];};

var FLOWP={s1:0,trade:8,pick:8,s2:15,cost:22,s3:28,evidence:40,money:40,root:55,rootlist:55,own:60,person:66,pq:72,test:78,fixed:82,actions:85,commit:92,plan:100,roadblock:100,idea:100,fit:100,dayone:100,how:100};
function setStep(scr){var lab=document.getElementById("steplabel"),bar=document.getElementById("barfill"),v=FLOWP[scr];
  lab.textContent=scr==="plan"?"Done":(v==null?"Saved on this phone":"");bar.style.width=(v==null?100:Math.max(4,v))+"%";}
function profHelper(){if(!S.prof)return null;if(S.prof.name)return S.prof.name;if(D.r5.who[S.prof.type])return D.r5.who[S.prof.type];var o=D.profile.ask.options.filter(function(x){return x[0]===S.prof.type;})[0];return o?"My "+o[1].replace(/^An? /,"").replace(/\s*\(.*\)$/,"").toLowerCase():null;}
function capL(x){return x?x.charAt(0).toUpperCase()+x.slice(1):x;}
function guessHelper(){var f=(S.first||"").toLowerCase(),H=D.helpers;if(S.prof)return profHelper();if(S.path==="doing"&&!S.prof)return H.me;if(/#2|second|lead|supervisor|manager/.test(f))return H.number2;if(/team|crew|everyone|staff|huddle/.test(f))return H.team;
  if(/bookkeeper|accountant|numbers|bank/.test(f))return H.bookkeeper;if(/spouse|family|home/.test(f))return H.family;if(/mentor|peer|coach/.test(f))return H.outside;
  var g=H[R(S.root).default_helper]||H.me;if(S.path==="doing"&&g===H.number2)return H.me;return g;}
function tradeChip(){var F2=D.flow2,t=S.trade?F2.trade_chip.replace("{t}",F2.trade_short[S.trade]||F2.trade_short.other):F2.trade_none;
  return el("button",{cls:"link tradechip",raw:"1",text:t,on:function(){S.tradeNext=S.scr;S.hist.push(S.scr);S.scr="trade";save();render(true);}});}
function ownLink(){var F2=D.flow2,w=el("div",{cls:"ownlink"}),ta=el("textarea",{rows:"2",placeholder:F2.own_ph,maxlength:"500","aria-label":"In my own words"});ta.value=S.own||"";
  ta.addEventListener("input",function(){S.own=ta.value;save();});var m=micFor(ta,function(v){S.own=v;save();});var box=el("div",{cls:"ownbox"},[ta,m]);box.style.display=S.own?"block":"none";
  w.appendChild(el("button",{cls:"link",text:F2.own_link,on:function(){box.style.display="block";ta.focus();}}));w.appendChild(box);return w;}
// ---------- vision builder (on this phone only) ----------
var TIER=(location.search.match(/[?&]tier=(\w+)/)||[])[1]||(LOCKS?"free":"all");
function visionLine(){var V2=D.vision;if(S.fixed&&!isNotSure(S.fixed))return S.fixed.replace(/\.?$/,".");return V2.flip[S.path]||V2.flip.off;}
function visionPicked(){return !!(S.fixed&&!isNotSure(S.fixed));}
function visionAll(){var out=[];plans().forEach(function(p){if(p.vision&&p.vision.line)out.push({id:p.id,line:p.vision.line,was:p.vision.was||"",group:p.vision.group||"self",edited:!!p.vision.edited,suggested:!p.vision.edited&&!p.vision.picked});});
  var seen={};return out.filter(function(v){var k=v.line.toLowerCase();if(seen[k])return false;seen[k]=1;return true;});}
V.vision=function(){var V2=D.vision,all=visionAll(),kids=[el("h1",{text:V2.heading}),el("p",{cls:"sub",text:D.sell.vision_sub})];
  if(!all.length){kids.push(el("p",{text:V2.empty}),nav());return kids;}
  var free=TIER==="free",shown=free?all.slice(0,1):all;
  Object.keys(V2.groups).forEach(function(g){var items=shown.filter(function(v){return v.group===g;});if(!items.length)return;
    kids.push(el("div",{cls:"glabel",text:V2.groups[g]}));var u=el("ul",{cls:"mirror vision"});
    items.forEach(function(v){var li=el("li",{},[v.was?el("div",{cls:"vwas",raw:"1",text:D.sell.was+" "+v.was}):null,el("div",{cls:"vline"},[el("span",{cls:"vto",text:D.sell.heading_to+" "}),el("span",{raw:"1",text:v.line}),v.suggested?el("span",{cls:"sugg",text:" "+D.r2.suggested}):null].filter(Boolean))].filter(Boolean));
      li.appendChild(el("button",{cls:"link small",text:V2.edit,on:function(){var inp=el("input",{type:"text",cls:"name",maxlength:"140","aria-label":V2.edit});inp.value=v.line;li.innerHTML="";li.appendChild(inp);inp.focus();
        function done(){var t=inp.value.trim();if(t){var p=getPlan(v.id);if(p){p.vision={line:t,was:v.was,group:v.group,edited:true};putPlan(p);}}render(false);}
        inp.addEventListener("keydown",function(e){if(e.key==="Enter")done();});inp.addEventListener("blur",done);}}));u.appendChild(li);});kids.push(u);});
  if(free){kids.push(el("p",{cls:"lockednote",text:D.sell.locked}),el("div",{cls:"actions"},[el("button",{cls:"btn ghost",text:D.pricing.link,on:function(){go("pricing");}}),el("button",{cls:"btn ghost",text:D.sell.not_now,on:back}) ]));}
  else{kids.push(el("div",{cls:"glabel",text:V2.draft_label}));var order=["people","money","customers","self"],para=[];order.forEach(function(g){all.forEach(function(v){if(v.group===g)para.push(v.line);});});
    kids.push(el("p",{cls:"visiondraft",raw:"1",text:para.join(" ")}));}
  kids.push(nav());return kids;};
function render(anim){if(render.last!==S.scr){clearToasts();render.last=S.scr;}setStep(S.scr);var fn=V[S.scr]||V.s1;var scr=el("div",{cls:"screen"});var ks=fn();
  if(S.scr!=="s1"&&S.scr!=="trade"){var nb=null;ks.forEach(function(k){if(k&&k.classList&&k.classList.contains("none"))nb=k;});if(nb&&!(S.scr in {plan:1,test:1}))ks.splice(ks.indexOf(nb),0,mineWidget(nb));

    if(S.scr in {s2:1,s3:1,evidence:1,root:1,rootlist:1,own:1,fixed:1,test:1,actions:1,commit:1})ks.unshift(echoLine());
    if(S.scr in {s2:1,s3:1,evidence:1,root:1,rootlist:1}){var ak=ackLine();if(ak)ks.splice(1,0,ak);}}
  ks.forEach(function(k){if(k)scr.appendChild(k);});
  app.innerHTML="";app.appendChild(scr);if(anim)window.scrollTo({top:0,behavior:"auto"});app.dataset.screen=S.scr;footLinks();ventFab();footExtras();
  if(S.scr==="s1"&&S.ventPath&&D.paths[S.ventPath]){var lb=D.paths[S.ventPath].label;app.querySelectorAll(".card").forEach(function(c){if(c.textContent===lb)c.classList.add("suggest");});}}
fetch("data.json").then(function(r){return r.json();}).then(function(d){D=d;S=load()||fresh();var ckq=(location.search.match(/[?&]ck=([\w-]+)/)||[])[1];if(ckq&&getPlan(ckq)){S.ckId=ckq;S.ck=null;S.hist=[];S.scr="checkback";save();}receiptBoot().then(function(){render(false);});})
 .catch(function(e){if(window.console)console.error(e);app.textContent="Couldn't load. Please refresh.";});
window.addEventListener("beforeprint",function(){document.querySelectorAll("details").forEach(function(d){d.open=true;});});
window.__pss={get state(){return S;},route:function(t){return route(t);},callWords:function(t){return (new RegExp(D.r3.call_words,"i")).test(t);},showQ:function(t){return (new RegExp(D.r5.hand_words,"i")).test(t)?D.r4.hand_q:D.r4.show_q;}};
})();
