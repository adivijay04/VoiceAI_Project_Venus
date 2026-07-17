// --- NAVIGATION LOGIC ---
function openApp(screenId) {
    document.getElementById("home-screen").style.opacity = "0";
    setTimeout(() => {
        document.getElementById("home-screen").style.display = "none";
        
        let appScreen = document.getElementById(screenId);
        appScreen.style.display = (screenId === 'chat-screen') ? "flex" : "flex"; 
        
        setTimeout(() => { 
            appScreen.style.opacity = "1"; 
            appScreen.style.transform = "scale(1)"; 
        }, 50);

        if (screenId === 'chat-screen') {
            loadHistory();
            if(document.getElementById("chat-box").innerHTML.trim() === "") startNewChat();
        }
    }, 500);
}

function goHome() {
    stopAudio(); 
    if(isRecording) recognition.stop();
    if(isSTTRecording) sttRecognition.stop();

    // Hide all app screens
    let screens = document.querySelectorAll('.app-screen');
    screens.forEach(screen => {
        screen.style.opacity = "0";
        setTimeout(() => { screen.style.display = "none"; }, 500);
    });

    setTimeout(() => {
        let home = document.getElementById("home-screen");
        home.style.display = "flex";
        setTimeout(() => home.style.opacity = "1", 50);
    }, 500);
}

// --- GENERAL AUDIO ---
function speakText(text) {
    stopAudio();
    let utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
}

function stopAudio() {
    window.speechSynthesis.cancel();
}

// --- APP 2: TEXT TO SPEECH ---
function playTTS() {
    let text = document.getElementById("tts-input").value;
    if(text.trim() !== "") speakText(text);
}

// --- APP 3: SPEECH TO TEXT ---
let sttRecognition;
let isSTTRecording = false;

if ('webkitSpeechRecognition' in window) {
    sttRecognition = new webkitSpeechRecognition();
    sttRecognition.continuous = true;
    sttRecognition.interimResults = true; 

    sttRecognition.onstart = function() {
        isSTTRecording = true;
        document.getElementById("btn-stt-mic").innerHTML = "🛑 Stop Listening";
        document.getElementById("btn-stt-mic").style.background = "#dc3545";
    };

    sttRecognition.onresult = function(event) {
        let final_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) final_transcript += event.results[i][0].transcript;
        }
        if (final_transcript !== '') {
            let currentVal = document.getElementById("stt-output").value;
            document.getElementById("stt-output").value = currentVal + (currentVal ? ' ' : '') + final_transcript;
        }
    };

    sttRecognition.onend = function() {
        isSTTRecording = false;
        document.getElementById("btn-stt-mic").innerHTML = "🎤 Start Listening";
        document.getElementById("btn-stt-mic").style.background = "#17a2b8";
    };
}

function toggleSTT() {
    if (!sttRecognition) return alert("Use Chrome or Edge for voice.");
    if (!isSTTRecording) {
        sttRecognition.start();
    } else {
        sttRecognition.stop(); 
    }
}

// --- APP 1: SMART AI (CHAT & DATABASE) LOGIC ---

function startNewChat() {
    stopAudio();
    document.getElementById("chat-box").innerHTML = ""; 
    document.getElementById("user-input").value = ""; 
    addMessage("Hello! I am Venus. How can I help you today?", 'bot', false); 
}

let currentEditId = -1;

function openEditModal(id, currentName) {
    currentEditId = id;
    document.getElementById("edit-modal-input").value = currentName;
    document.getElementById("edit-modal").style.display = "flex";
    document.getElementById("edit-modal-input").focus();
}

function closeEditModal() {
    document.getElementById("edit-modal").style.display = "none";
    currentEditId = -1;
}

async function saveEditedName() {
    let newName = document.getElementById("edit-modal-input").value.trim();
    if (newName !== "" && currentEditId !== -1) {
        await fetch('/api/history/' + currentEditId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newName })
        });
        loadHistory();
        closeEditModal();
    }
}

async function saveToHistory(question, answer) {
    await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: question, q: question, a: answer })
    });
    loadHistory();
}

async function loadHistory() {
    let response = await fetch('/api/history');
    let history = await response.json();
    
    let list = document.getElementById("history-list");
    list.innerHTML = "";
    
    for (let i = history.length - 1; i >= 0; i--) {
        let item = history[i];

        let wrapper = document.createElement("div");
        wrapper.className = "history-wrapper";

        let div = document.createElement("div");
        div.className = "history-item";
        div.innerText = "💬 " + item.title;
        
        div.onclick = function() {
            stopAudio();
            document.getElementById("chat-box").innerHTML = ""; 
            addMessage(item.q, 'user', false); 
            addMessage(item.a, 'bot', false);  
        };

        let editBtn = document.createElement("button");
        editBtn.className = "btn-action-history btn-edit";
        editBtn.innerHTML = "✏️";
        editBtn.onclick = function(e) { e.stopPropagation(); openEditModal(item.id, item.title); };

        let delBtn = document.createElement("button");
        delBtn.className = "btn-action-history btn-del";
        delBtn.innerHTML = "❌";
        delBtn.onclick = async function(e) {
            e.stopPropagation(); 
            await fetch('/api/history/' + item.id, { method: 'DELETE' });
            loadHistory(); 
            startNewChat(); 
        };
        
        wrapper.appendChild(div);
        wrapper.appendChild(editBtn);
        wrapper.appendChild(delBtn);
        list.appendChild(wrapper);
    }
}

async function clearAllHistory() {
    if (confirm("Are you sure you want to delete all history?")) {
        await fetch('/api/history/all', { method: 'DELETE' });
        loadHistory();
        startNewChat();
    }
}

let recognition;
let isRecording = false;

if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true; 

    recognition.onstart = function() {
        isRecording = true;
        document.getElementById("btn-mic").innerHTML = "🛑 Stop";
        document.getElementById("btn-mic").style.background = "#dc3545";
        document.getElementById("listening-status").style.display = "block";
    };

    recognition.onresult = function(event) {
        let final_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) final_transcript += event.results[i][0].transcript;
        }
        if (final_transcript !== '') {
            let currentVal = document.getElementById("user-input").value;
            document.getElementById("user-input").value = currentVal + (currentVal ? ' ' : '') + final_transcript;
        }
    };

    recognition.onend = function() {
        isRecording = false;
        document.getElementById("btn-mic").innerHTML = "🎤 Speak";
        document.getElementById("btn-mic").style.background = "#17a2b8";
        document.getElementById("listening-status").style.display = "none";
    };
}

function toggleDictation() {
    if (!recognition) return alert("Use Chrome or Edge for voice.");
    if (!isRecording) {
        document.getElementById("user-input").value = ""; 
        recognition.start();
    } else {
        recognition.stop(); 
        setTimeout(() => { if (document.getElementById("user-input").value.trim() !== "") sendText(); }, 500);
    }
}

function addMessage(text, sender, shouldSpeak = true) {
    const row = document.createElement("div");
    row.className = `message-row ${sender === 'user' ? 'row-user' : 'row-bot'}`;
    row.innerHTML = `<div class="avatar">${sender === 'user' ? '🧑‍💻' : '👩‍🚀'}</div>
                     <div class="message ${sender === 'user' ? 'user-msg' : 'bot-msg'}">${text}</div>`;
    document.getElementById("chat-box").appendChild(row);
    document.getElementById("chat-box").scrollTop = document.getElementById("chat-box").scrollHeight;
    
    if(sender === 'bot' && shouldSpeak) speakText(text); 
}

async function sendText() {
    if(isRecording) recognition.stop(); 

    let input = document.getElementById("user-input");
    let text = input.value.trim();
    if (!text) return;
    
    if (document.getElementById("chat-box").innerHTML.indexOf("bot-msg") === -1) startNewChat();
    
    addMessage(text, 'user', false);
    input.value = '';

    let typingId = "typing-" + Date.now();
    document.getElementById("chat-box").insertAdjacentHTML('beforeend', `<div id="${typingId}" class="message-row row-bot"><div class="avatar">👩‍🚀</div><div class="message bot-msg"><em>thinking...</em></div></div>`);
    document.getElementById("chat-box").scrollTop = document.getElementById("chat-box").scrollHeight;

    try {
        let response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        let data = await response.json();
        
        document.getElementById(typingId).remove();
        addMessage(data.reply, 'bot', true);
        saveToHistory(text, data.reply);
        
    } catch (e) {
        document.getElementById(typingId).remove();
        addMessage("Error connecting to backend.", 'bot', true);
    }
}

// --- APP 4: FILE READER LOGIC ---
async function uploadAndReadFile() {
    let fileInput = document.getElementById("file-input");
    if(fileInput.files.length === 0) {
        alert("Please select a file first!");
        return;
    }

    let file = fileInput.files[0];
    let formData = new FormData();
    formData.append("file", file);

    // Show Loading Spinner, hide buttons and text box
    document.getElementById("file-loading").style.display = "block";
    document.getElementById("btn-read-file").style.display = "none";
    document.getElementById("file-output").style.display = "none";
    document.getElementById("btn-stop-file").style.display = "none";
    
    stopAudio(); // Stop any currently playing audio

    try {
        let response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        let data = await response.json();

        // Hide Loading Spinner
        document.getElementById("file-loading").style.display = "none";
        document.getElementById("btn-read-file").style.display = "inline-block";

        if(data.error) {
            alert(data.error);
        } else {
            // Show the text
            document.getElementById("file-output").style.display = "block";
            document.getElementById("file-output").value = data.text;
            
            // Show Stop Button and start reading!
            document.getElementById("btn-stop-file").style.display = "inline-block";
            speakText(data.text);
        }
    } catch (e) {
        document.getElementById("file-loading").style.display = "none";
        document.getElementById("btn-read-file").style.display = "inline-block";
        alert("Error reading the file. Make sure your Python server is running!");
    }
}
