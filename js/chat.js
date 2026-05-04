/**
 * chat.js — Floating AI chat widget.
 * Reads profile context from PROFILE (data/profile.js).
 * API endpoint injected by main.js via Chat.init(url).
 */

const Chat = (() => {
  let API_ENDPOINT = "";
  let isOpen=false, isLoading=false, messages=[];
  let bubbleEl, panelEl, messagesEl, inputEl, sendEl, closeEl;

  function systemPrompt() {
    const exp = PROFILE.experience.map(e=>`${e.title} at ${e.company} (${e.period}): ${e.bullets.join(" ")}`).join("\n\n");
    const skills = Object.entries(PROFILE.skills).map(([k,v])=>`${k}: ${v.join(", ")}`).join("\n");
    const patents = PROFILE.patents.map(p=>`${p.title} — ${p.number} (${p.date})`).join("\n");
    return `You are a concise, professional assistant representing ${PROFILE.name}, a ${PROFILE.title}.
Answer questions about his experience, skills, patents, and contact information based only on the profile below.
If someone asks how to reach him, share his email and LinkedIn.
If asked something unrelated to his professional profile, say: "I'm here to answer questions about Ravi's background — happy to help with that!"
Keep answers to 3-4 sentences max unless the user asks for more detail. Be warm and professional, not robotic.

SUMMARY: ${PROFILE.summary}

EXPERIENCE:
${exp}

SKILLS:
${skills}

PATENTS:
${patents}

EDUCATION: ${PROFILE.education.degree}, ${PROFILE.education.school} (${PROFILE.education.years})
CONTACT: email: ${PROFILE.email} | phone: ${PROFILE.phone} | linkedin: ${PROFILE.linkedin}`;
  }

  function appendMessage(role, text) {
    const wrap=document.createElement("div");
    wrap.style.cssText=`display:flex;justify-content:${role==="user"?"flex-end":"flex-start"};margin-bottom:10px;`;
    const bubble=document.createElement("div");
    bubble.style.cssText=`max-width:78%;padding:9px 13px;border-radius:${role==="user"?"14px 14px 3px 14px":"14px 14px 14px 3px"};font-size:13px;line-height:1.6;background:${role==="user"?"#a0782a":"#f0ede8"};color:${role==="user"?"#fff":"#1a1816"};font-family:'DM Sans',sans-serif;`;
    bubble.textContent=text;
    wrap.appendChild(bubble); messagesEl.appendChild(wrap);
    messagesEl.scrollTop=messagesEl.scrollHeight;
  }

  function showTyping() {
    const wrap=document.createElement("div"); wrap.id="chat-typing"; wrap.style.cssText="display:flex;margin-bottom:10px;";
    wrap.innerHTML=`<div style="background:#f0ede8;padding:9px 13px;border-radius:14px 14px 14px 3px;"><span style="display:inline-flex;gap:4px;align-items:center;"><span style="width:6px;height:6px;border-radius:50%;background:#a0782a;animation:chatBounce 1s infinite 0s"></span><span style="width:6px;height:6px;border-radius:50%;background:#a0782a;animation:chatBounce 1s infinite 0.2s"></span><span style="width:6px;height:6px;border-radius:50%;background:#a0782a;animation:chatBounce 1s infinite 0.4s"></span></span></div>`;
    messagesEl.appendChild(wrap); messagesEl.scrollTop=messagesEl.scrollHeight;
  }

  function hideTyping() { const el=document.getElementById("chat-typing"); if(el) el.remove(); }

  async function send() {
    const text=inputEl.value.trim(); if(!text||isLoading) return;
    inputEl.value=""; isLoading=true; sendEl.disabled=true;
    messages.push({role:"user",content:text});
    appendMessage("user",text); showTyping();
    try {
      const res=await fetch(API_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages,system:systemPrompt()})});
      if(!res.ok) throw new Error(res.status);
      const data=await res.json();
      const reply=data.content?.[0]?.text||"Sorry, I couldn't get a response.";
      hideTyping(); messages.push({role:"assistant",content:reply}); appendMessage("assistant",reply);
    } catch(e) { hideTyping(); appendMessage("assistant","Sorry, I'm having trouble connecting right now. Please try again shortly."); }
    finally { isLoading=false; sendEl.disabled=false; inputEl.focus(); }
  }

  function open() {
    isOpen=true; panelEl.style.display="flex"; bubbleEl.style.display="none";
    if(messages.length===0) appendMessage("assistant","Hi! I'm Ravi's AI assistant — custom built for this portfolio and powered by Claude. Ask me anything about his experience, skills, or background.");
    inputEl.focus();
  }

  function close() { isOpen=false; panelEl.style.display="none"; bubbleEl.style.display="flex"; }

  function init(apiEndpoint) {
    API_ENDPOINT=apiEndpoint;
    const style=document.createElement("style");
    style.textContent=`
      @keyframes chatBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
      #chat-bubble{position:fixed;bottom:24px;right:24px;z-index:9000;width:52px;height:52px;border-radius:50%;background:#a0782a;color:#fff;font-size:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.12);transition:transform 0.2s;border:none;}
      #chat-bubble:hover{transform:scale(1.08);}
      #chat-panel{position:fixed;bottom:24px;right:24px;z-index:9000;width:360px;height:500px;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.12);border:1px solid #e5e2de;flex-direction:column;display:none;font-family:'DM Sans',sans-serif;overflow:hidden;}
      #chat-header{background:#1a1816;color:#e8e4dc;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}
      #chat-messages{flex:1;overflow-y:auto;padding:14px;background:#faf9f7;}
      #chat-footer{padding:10px 12px;border-top:1px solid #e5e2de;display:flex;gap:8px;background:#fff;flex-shrink:0;}
      #chat-input{flex:1;border:1px solid #e5e2de;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;font-family:'DM Sans',sans-serif;color:#1a1816;}
      #chat-input:focus{border-color:#a0782a;}
      #chat-send{background:#a0782a;color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px;font-family:'DM Mono',monospace;transition:background 0.2s;}
      #chat-send:hover{background:#b8883a;} #chat-send:disabled{opacity:0.5;cursor:not-allowed;}
      #chat-close-btn{background:none;border:none;color:#6b6760;cursor:pointer;font-size:18px;line-height:1;padding:0;transition:color 0.2s;}
      #chat-close-btn:hover{color:#e8e4dc;}
    `;
    document.head.appendChild(style);

    bubbleEl=document.createElement("button"); bubbleEl.id="chat-bubble"; bubbleEl.innerHTML="💬"; bubbleEl.title="Ask Ravi's AI assistant";
    panelEl=document.createElement("div"); panelEl.id="chat-panel";
    panelEl.innerHTML=`
      <div id="chat-header">
        <div>
          <div style="font-weight:500;font-size:14px;">Ask Ravi's AI</div>
          <div style="font-size:11px;color:#6b6760;font-family:'DM Mono',monospace;">Custom built · Powered by Claude</div>
        </div>
        <button id="chat-close-btn" title="Close">✕</button>
      </div>
      <div id="chat-messages"></div>
      <div id="chat-footer">
        <input id="chat-input" type="text" placeholder="Ask about Ravi's experience..." autocomplete="off"/>
        <button id="chat-send">Send</button>
      </div>`;

    document.body.appendChild(bubbleEl); document.body.appendChild(panelEl);
    messagesEl=document.getElementById("chat-messages");
    inputEl=document.getElementById("chat-input");
    sendEl=document.getElementById("chat-send");
    closeEl=document.getElementById("chat-close-btn");

    bubbleEl.addEventListener("click",()=>{open();if(window.Audio)Audio.pop();});
    closeEl.addEventListener("click",()=>{close();if(window.Audio)Audio.pop();});
    sendEl.addEventListener("click",send);
    inputEl.addEventListener("keydown",e=>{if(e.key==="Enter")send();});
  }

  return {init};
})();
