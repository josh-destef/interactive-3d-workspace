import { TOTAL_BEATS, NUMBERED_STEPS } from './config.js?v=selector5';
export function setCaption(step,title,body){
 const label=document.getElementById('cap-step');label.textContent=step?step+' / '+NUMBERED_STEPS:'Free play';label.classList.add('on');
 for(const [id,text] of [['cap-title',title],['cap-body',body]]){const el=document.getElementById(id);el.textContent=text;el.classList.add('on');}
}
export function showContinue(){document.getElementById('btn-continue').classList.add('on');}
export function hideContinue(){document.getElementById('btn-continue').classList.remove('on');document.getElementById('btn-finish').classList.remove('on');}
export function setProgress(idx){document.getElementById('prog-fill').style.width=(idx/(TOTAL_BEATS-1)*100)+'%';}
export function showFinishButton(){document.getElementById('btn-finish').classList.add('on');}

