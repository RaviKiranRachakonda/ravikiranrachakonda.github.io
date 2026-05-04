/**
 * terminal.js — Interactive terminal widget.
 * Reads all data from PROFILE (data/profile.js).
 * State machine: main → experience → exp_detail → leaf
 */

const Terminal = (() => {
  const GOLD  = "#c8a96e";
  const MUTED = "#6b6760";
  const WHITE = "#e8e4dc";
  const RED   = "#ff5f57";

  let state = "main", outputEl = null, inputEl = null;

  function print(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    outputEl.appendChild(div);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function span(text, color) { return `<span style="color:${color}">${text}</span>`; }
  function option(num, label) { return `<div style="margin:1px 0">${span("  "+num, GOLD)}  ${span(label, WHITE)}</div>`; }

  function printMainMenu() {
    print(`<br>${span("Hi! I'm Ravi's portfolio terminal.", GOLD)}`);
    print(`${span("What would you like to explore?", MUTED)}<br>`);
    print(option("1","Experience")); print(option("2","Skills"));
    print(option("3","Patents")); print(option("4","Phone")); print(option("5","Email"));
    print(`<br>${span("  m",GOLD)}  ${span("Main menu &nbsp;|&nbsp; clear — reset", MUTED)}`);
    state = "main";
  }

  function printExperienceMenu() {
    print(`<br>${span("Experience",GOLD)} ${span("— pick a role:",MUTED)}<br>`);
    PROFILE.experience.forEach(exp => print(option(exp.id,`${exp.title} — ${exp.company} (${exp.period})`)));
    print(`<br>${option("0","← Back")}`);
    state = "experience";
  }

  function printExperienceDetail(id) {
    const exp = PROFILE.experience.find(e => e.id === id);
    if (!exp) { print(span(`Role ${id} not found. Try again.`, RED)); return; }
    print(`<br>${span(exp.title, GOLD)}`);
    print(`${span(exp.company+" · "+exp.period+" · "+exp.location, MUTED)}<br>`);
    exp.bullets.forEach(b => print(`${span("  •",GOLD)} ${span(b,WHITE)}`));
    print(`<br>${span("  Tags:",MUTED)} ${span(exp.tags.join(", "),GOLD)}`);
    print(`<br>${option("0","← Roles")} ${option("m","Main menu")}`);
    state = "exp_detail";
  }

  function printSkills() {
    print(`<br>${span("Skills",GOLD)}<br>`);
    Object.entries(PROFILE.skills).forEach(([cat,items]) => print(`${span("  "+cat,GOLD)}  ${span(items.join(", "),WHITE)}`));
    print(`<br>${option("m","Main menu")}`); state = "leaf";
  }

  function printPatents() {
    print(`<br>${span("Patents",GOLD)}<br>`);
    PROFILE.patents.forEach(p => print(`${span("  •",GOLD)} ${span(p.title+" — "+p.number+" ("+p.date+")",WHITE)}`));
    print(`<br>${option("m","Main menu")}`); state = "leaf";
  }

  function printPhone() {
    print(`<br>${span("📞",WHITE)} <a href="tel:${PROFILE.phone}" style="color:${GOLD}">${PROFILE.phone}</a>`);
    print(`<br>${option("m","Main menu")}`); state = "leaf";
  }

  function printEmail() {
    print(`<br>${span("✉️",WHITE)} <a href="mailto:${PROFILE.email}" style="color:${GOLD}">${PROFILE.email}</a>`);
    print(`<br>${option("m","Main menu")}`); state = "leaf";
  }

  function handleInput(raw) {
    const val = raw.trim().toLowerCase();
    if (!val) return;
    print(`${span("› "+val, MUTED)}`);
    if (val==="m"||val==="menu"||val==="main") { printMainMenu(); return; }
    if (val==="clear"||val==="cls") { outputEl.innerHTML=""; printMainMenu(); return; }

    if (state==="main") {
      const map={"1":printExperienceMenu,"2":printSkills,"3":printPatents,"4":printPhone,"5":printEmail};
      if (map[val]) map[val]();
      else print(span(`Unknown option "${val}". Type 1–5.`, RED));
    }
    else if (state==="experience") {
      if (val==="0") printMainMenu();
      else { const id=parseInt(val); if(id>=1&&id<=PROFILE.experience.length) printExperienceDetail(id); else print(span(`Type 1–${PROFILE.experience.length} or 0 to go back.`,RED)); }
    }
    else if (state==="exp_detail") { if(val==="0") printExperienceMenu(); else printMainMenu(); }
    else { printMainMenu(); }
  }

  function init(outputId, inputId, wrapperId) {
    outputEl = document.getElementById(outputId);
    inputEl  = document.getElementById(inputId);
    inputEl.addEventListener("keydown", e => { if(e.key==="Enter"){const v=inputEl.value;inputEl.value="";handleInput(v);} });
    document.getElementById(wrapperId).addEventListener("click", ()=>inputEl.focus());
    printMainMenu();
  }

  return { init };
})();
