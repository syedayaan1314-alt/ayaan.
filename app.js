(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const screens = ["lock", "home", "chat", "voice", "tools", "settings"];
  const FIXED_PIN = "0103";
  let pin = "", pinMode = "unlock", listening = false;
  const toast = (message) => {
    const el = $("#toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2500);
  };
  const showScreen = (name) => {
    if (!screens.includes(name)) name = "home";
    $$(".screen").forEach(s => s.classList.toggle("active", s.id === `screen-${name}`));
    $$(".nav-item").forEach(b => b.classList.toggle("selected", b.dataset.screen === name));
    if (name === "chat") setTimeout(() => $("#chatInput").focus(), 100);
    if (name === "home") updateClock();
    window.scrollTo({top: 0, behavior: document.body.classList.contains("reduce-motion") ? "auto" : "smooth"});
  };
  $$("[data-screen]").forEach(el => el.addEventListener("click", e => {
    const name = el.dataset.screen;
    if (name && el.tagName === "A") return;
    e.preventDefault(); showScreen(name);
  }));
  $("#settingsTop").addEventListener("click", () => showScreen("settings"));

  function updateDots() {
    $$("#pinDots i").forEach((dot, i) => dot.classList.toggle("filled", i < pin.length));
  }
  function setLockMode(mode) {
    pinMode = "unlock"; pin = ""; updateDots();
    $("#lockTitle").textContent = "Welcome back, Sir.";
    $("#lockHint").textContent = "Enter your access code to initialize JARVIS.";
    $("#lockFoot").textContent = "ENTER YOUR 4-DIGIT ACCESS CODE";
  }
  function enterPin() {
    if (pin.length !== 4) { toast("Enter all 4 digits first."); return; }
    if (pin === FIXED_PIN) { showScreen("home"); toast("Access granted."); }
    else { pin = ""; updateDots(); toast("Incorrect code. Try again."); }
  }
  $("#keypad").addEventListener("click", e => {
    const button = e.target.closest("button[data-key]"); if (!button) return;
    const key = button.dataset.key;
    if (key === "clear") { pin = ""; updateDots(); return; }
    if (key === "enter") { enterPin(); return; }
    if (/^\d$/.test(key) && pin.length < 4) { pin += key; updateDots(); if (pin.length === 4 && pinMode === "unlock") setTimeout(enterPin, 180); }
  });
  $("#resetPin").addEventListener("click", () => {
    toast("The access code is fixed to 0103 in this version.");
  });
  $("#lockNow").addEventListener("click", () => { setLockMode("unlock"); showScreen("lock"); });
  setLockMode("unlock");

  function updateClock() {
    const now = new Date();
    $("#clock").textContent = now.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
    $("#dateLine").textContent = now.toLocaleDateString([], {weekday:"short", month:"short", day:"numeric"}).toUpperCase();
  }
  updateClock(); setInterval(updateClock, 30000);

  const messages = $("#messages");
  function addMessage(role, text) {
    const item = document.createElement("div"); item.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;
    const label = document.createElement("span"); label.className = "message-label"; label.textContent = role === "user" ? "YOU" : "JARVIS";
    const p = document.createElement("p"); p.textContent = text; item.append(label, p); messages.appendChild(item); messages.scrollTop = messages.scrollHeight; return p;
  }
  async function askJarvis(text) {
    addMessage("user", text); $("#chatInput").value = "";
    const answerEl = addMessage("assistant", "Connecting to the AI core…");
    $("#apiStatus").textContent = "REQUEST IN PROGRESS";
    try {
      const response = await fetch("/api/chat", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({message:text})});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The AI endpoint returned an error.");
      const answer = data.reply || "I didn't receive a reply. Please try again.";
      answerEl.textContent = answer; $("#apiStatus").textContent = "CONNECTED";
      if ($("#speechToggle").checked && "speechSynthesis" in window) speak(answer);
    } catch (err) {
      answerEl.textContent = `I couldn't reach the AI service. ${err.message} Check that the site is deployed with GEMINI_API_KEY configured.`;
      $("#apiStatus").textContent = "CHECK SERVER SETUP";
    }
    messages.scrollTop = messages.scrollHeight;
  }
  $("#chatForm").addEventListener("submit", e => {
    e.preventDefault(); const text = $("#chatInput").value.trim(); if (text) askJarvis(text);
  });
  $("#chatInput").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#chatForm").requestSubmit(); }
  });
  $$(".suggestions button").forEach(b => b.addEventListener("click", () => { $("#chatInput").value = b.dataset.prompt; $("#chatForm").requestSubmit(); }));
  $("#clearChat").addEventListener("click", () => { messages.replaceChildren(); addMessage("assistant", "Conversation cleared. How can I help, Sir?"); });
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.rate = 1; utterance.pitch = .95; window.speechSynthesis.speak(utterance);
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  $("#micButton").addEventListener("click", () => {
    if (!SpeechRecognition) { toast("Voice recognition is not supported here. Try Chrome or type instead."); return; }
    if (listening && window.jarvisRecognition) { window.jarvisRecognition.stop(); return; }
    const recognition = new SpeechRecognition(); window.jarvisRecognition = recognition;
    recognition.lang = navigator.language || "en-US"; recognition.interimResults = true; recognition.continuous = false;
    listening = true; $("#voiceOrb").classList.add("listening"); $("#voiceTitle").textContent = "Listening…"; $("#voiceHint").textContent = "Speak clearly. Tap the button to stop.";
    $("#micButton").innerHTML = "<span>■</span> Stop listening";
    recognition.onresult = e => {
      const transcript = [...e.results].map(r => r[0].transcript).join("");
      $("#voiceTranscript").textContent = transcript;
      if (e.results[e.results.length - 1].isFinal) {
        $("#voiceTranscript").textContent = transcript; listening = false; $("#voiceOrb").classList.remove("listening");
        $("#voiceTitle").textContent = "Request captured."; $("#voiceHint").textContent = "Sending your request to JARVIS…"; $("#micButton").innerHTML = "<span>🎙</span> Start listening";
        showScreen("chat"); $("#chatInput").value = transcript; $("#chatForm").requestSubmit();
      }
    };
    recognition.onerror = e => { toast(`Voice error: ${e.error}`); stopListening(); };
    recognition.onend = () => { if (listening) stopListening(); };
    recognition.start();
  });
  function stopListening() {
    listening = false; $("#voiceOrb").classList.remove("listening"); $("#voiceTitle").textContent = "Ready when you are."; $("#voiceHint").textContent = "Tap the microphone and speak naturally."; $("#micButton").innerHTML = "<span>🎙</span> Start listening";
  }
  $("#speechToggle").addEventListener("change", e => { if (!e.target.checked && "speechSynthesis" in window) speechSynthesis.cancel(); });
  $("#motionToggle").addEventListener("change", e => document.body.classList.toggle("reduce-motion", e.target.checked));

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
})();