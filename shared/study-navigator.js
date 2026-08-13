(function(){
  'use strict';
  var KEY='gongboo_last_study_v1';
  var ROOT_PREFIX=location.pathname.indexOf('/bible/')===0?'/bible':'';
  var BIBLE_URL=ROOT_PREFIX+'/supabase/app/';
  var LICENSE_URL=ROOT_PREFIX+'/license/app/';
  var OT=['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1-Samuel','2-Samuel','1-Kings','2-Kings','1-Chronicles','2-Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song-of-Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi'];
  var NT=['Matthew','Mark','Luke','John','Acts','Romans','1-Corinthians','2-Corinthians','Galatians','Ephesians','Philippians','Colossians','1-Thessalonians','2-Thessalonians','1-Timothy','2-Timothy','Titus','Philemon','Hebrews','James','1-Peter','2-Peter','1-John','2-John','3-John','Jude','Revelation'];
  var PRODUCTS={realestate:'Real Estate',insurance:'Insurance',mortgage:'Mortgage NMLS',notary:'Notary'};
  var tree={name:'Select Study',children:[{name:'Bible',children:[{name:'Old Testament',children:OT.map(bookNode)},{name:'New Testament',children:NT.map(bookNode)}]},{name:'License',children:[{name:'National',children:[productNode('mortgage')]},{name:'California',children:[productNode('realestate'),productNode('insurance'),productNode('notary')]}]}]};
  var stack=[tree],button,label,overlay,list,path;
  function prettyBook(name){return name.replace(/-/g,' ')}
  function bookNode(name){return{name:prettyBook(name),id:'BIB-'+(OT.indexOf(name)>=0?'OT':'NT')+'-'+name,url:BIBLE_URL+'?study='+encodeURIComponent('book:'+name)}}
  function productNode(code){return{name:PRODUCTS[code],id:'LIC-'+code.toUpperCase(),url:LICENSE_URL+'?study='+encodeURIComponent('product:'+code)}}
  function saved(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}}
  function remember(node){localStorage.setItem(KEY,JSON.stringify({id:node.id,name:node.name,url:node.url}));setLabel(node.name)}
  function setLabel(value){if(label)label.textContent=value||'Select Study'}
  function render(){var node=stack[stack.length-1];path.textContent=stack.map(function(x){return x.name}).join(' › ');list.innerHTML='';node.children.forEach(function(child){var item=document.createElement('button');item.type='button';item.className='study-nav-item';var last=saved();if(last&&last.id===child.id)item.classList.add('study-nav-item-current');item.innerHTML='<span></span><span class="study-nav-kind">'+(child.children?'›':(last&&last.id===child.id?'✓':''))+'</span>';item.firstChild.textContent=child.name;item.onclick=function(){if(child.children){stack.push(child);render()}else{remember(child);close();navigate(child)}};list.appendChild(item)})}
  function open(){stack=[tree];render();overlay.hidden=false;button.setAttribute('aria-expanded','true')}
  function close(){overlay.hidden=true;button.setAttribute('aria-expanded','false')}
  function navigate(node){var here=location.pathname;var target=new URL(node.url,location.origin);if(here===target.pathname){history.replaceState(null,'',target.pathname+target.search);applyRequested()}else location.href=target.href}
  function applyRequested(){var request=new URLSearchParams(location.search).get('study')||'';if(!request)return;if(request.indexOf('book:')===0){var book=request.slice(5),node=bookNode(book);remember(node);retry(function(){var target=document.querySelector('#bibleBookPicker [data-book="'+book+'"]');if(!target)return false;target.click();return true})}else if(request.indexOf('product:')===0){var code=request.slice(8);if(!PRODUCTS[code])return;var node2=productNode(code);remember(node2);retry(function(){var target=document.querySelector('[data-product="'+code+'"]');if(!target)return false;target.click();return true})}}
  function retry(action){var count=0,timer=setInterval(function(){count++;if(action()||count>80)clearInterval(timer)},100)}
  function mount(){var title=document.querySelector('.sat-title');if(!title)return;title.textContent='';button=document.createElement('button');button.type='button';button.className='study-nav-button';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');button.innerHTML='<span class="study-nav-label"></span><span class="study-nav-arrow">▼</span>';label=button.firstChild;title.appendChild(button);setLabel((saved()||{}).name||'Select Study');button.onclick=open;
    overlay=document.createElement('div');overlay.className='study-nav-backdrop';overlay.hidden=true;overlay.innerHTML='<section class="study-nav-panel" role="dialog" aria-modal="true" aria-label="Select study"><header class="study-nav-head"><button type="button" data-study-back aria-label="Back">‹</button><div class="study-nav-path"></div><button type="button" data-study-close aria-label="Close">×</button></header><div class="study-nav-list"></div></section>';document.body.appendChild(overlay);list=overlay.querySelector('.study-nav-list');path=overlay.querySelector('.study-nav-path');overlay.querySelector('[data-study-close]').onclick=close;overlay.querySelector('[data-study-back]').onclick=function(){if(stack.length>1){stack.pop();render()}else close()};overlay.onclick=function(e){if(e.target===overlay)close()};document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!overlay.hidden)close()});applyRequested();
    new MutationObserver(function(){if(!title.contains(button)){title.textContent='';title.appendChild(button);setLabel((saved()||{}).name||'Select Study')}}).observe(title,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
