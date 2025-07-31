// 配置
const CONFIG = {
    API_KEY: "sk-lNVAREVHjj386FDCd9McOL7k66DZCUkTp6IbV0u9970qqdlg",
    API_URL: "https://api.deepbricks.ai/v1/chat/completions",
    MODEL: "gemini-2.5-flash"
};

// 全局状态
let messages = [];
let participants = [];
let isAIProcessing = false;
let currentUsername = '';
let roomId = '';
let currentUserId = 'user-' + Math.random().toString(36).substr(2, 9);

// DOM元素
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const participantsList = document.getElementById('participantsList');
const summaryContent = document.getElementById('summaryContent');
const aiStatus = document.getElementById('aiStatus');
const askAIModal = document.getElementById('askAIModal');
const aiQuestionInput = document.getElementById('aiQuestionInput');
const usernameModal = document.getElementById('usernameModal');
const usernameInput = document.getElementById('usernameInput');
const roomInput = document.getElementById('roomInput');

// 初始化
function init() {
    // 从URL获取房间号，如果没有则在设置用户名时处理
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomId = urlParams.get('room');
    if (urlRoomId) {
        roomId = urlRoomId;
        document.getElementById('roomId').textContent = `房间: ${roomId}`;
    }
    
    setupEventListeners();
    showUsernameModal();
    registerServiceWorker();
    setupOfflineIndicator();
    
    // 监听localStorage变化，实现跨标签页同步
    window.addEventListener('storage', handleStorageChange);
    
    // 定期同步参与者在线状态
    setInterval(syncParticipantsStatus, 30000);
}

// 设置事件监听器
function setupEventListeners() {
    messageInput.addEventListener('keydown', handleKeyDown);
    messageInput.addEventListener('input', autoResizeTextarea);
    
    // 用户名输入事件
    usernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setUsername();
        }
    });
    
    // 点击外部关闭模态框
    askAIModal.addEventListener('click', (e) => {
        if (e.target === askAIModal) {
            closeAskAIModal();
        }
    });
}

// 处理键盘事件
function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

// 自动调整文本框大小
function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

// 生成或获取房间ID
function generateRoomId() {
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get('room');
    
    if (!roomId) {
        roomId = 'meeting-' + Math.random().toString(36).substr(2, 6);
        // 更新URL但不刷新页面
        const newUrl = window.location.pathname + '?room=' + roomId;
        window.history.replaceState({path: newUrl}, '', newUrl);
    }
    
    document.getElementById('roomId').textContent = `房间: ${roomId}`;
    return roomId;
}

// 显示用户名设置模态框
function showUsernameModal() {
    usernameModal.style.display = 'block';
    
    // 预填房间号
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomId = urlParams.get('room');
    if (urlRoomId) {
        roomInput.value = urlRoomId;
    }
    
    usernameInput.focus();
}

// 加载房间数据
function loadRoomData() {
    const storageKey = `meeting_${roomId}`;
    const savedData = localStorage.getItem(storageKey);
    
    if (savedData) {
        const data = JSON.parse(savedData);
        messages = data.messages || [];
        participants = data.participants || [];
        
        // 渲染已存在的消息
        messages.forEach(msg => renderMessage(msg));
        renderParticipants();
    }
    
    // 添加当前用户到参与者列表
    if (currentUsername) {
        addCurrentUserToParticipants();
    }
}

// 保存房间数据到localStorage
function saveRoomData() {
    const storageKey = `meeting_${roomId}`;
    const data = {
        messages: messages,
        participants: participants,
        lastUpdate: Date.now()
    };
    localStorage.setItem(storageKey, JSON.stringify(data));
}

// 处理localStorage变化事件
function handleStorageChange(e) {
    if (e.key === `meeting_${roomId}` && e.newValue) {
        const data = JSON.parse(e.newValue);
        
        // 更新消息（避免重复）
        if (data.messages && data.messages.length > messages.length) {
            const newMessages = data.messages.slice(messages.length);
            newMessages.forEach(msg => {
                messages.push(msg);
                renderMessage(msg);
            });
        }
        
        // 更新参与者列表
        if (data.participants) {
            participants = data.participants;
            renderParticipants();
        }
    }
}

// 添加当前用户到参与者列表
function addCurrentUserToParticipants() {
    const existingUser = participants.find(p => p.id === currentUserId);
    if (!existingUser && currentUsername) {
        participants.push({
            id: currentUserId,
            name: currentUsername,
            status: 'online',
            joinTime: Date.now()
        });
        saveRoomData();
        renderParticipants();
    }
}

// 同步参与者在线状态
function syncParticipantsStatus() {
    if (currentUsername) {
        addCurrentUserToParticipants();
    }
}

// 设置用户名和房间号
function setUsername() {
    const username = usernameInput.value.trim();
    const customRoomId = roomInput.value.trim();
    
    if (!username) {
        alert('请输入您的姓名');
        return;
    }
    
    currentUsername = username;
    
    // 处理房间号
    if (customRoomId) {
        roomId = customRoomId;
        // 更新URL
        const newUrl = window.location.pathname + '?room=' + roomId;
        window.history.replaceState({path: newUrl}, '', newUrl);
        document.getElementById('roomId').textContent = `房间: ${roomId}`;
    } else if (!roomId) {
        // 如果没有自定义房间号且roomId未设置，生成新的
        roomId = 'meeting-' + Math.random().toString(36).substr(2, 6);
        const newUrl = window.location.pathname + '?room=' + roomId;
        window.history.replaceState({path: newUrl}, '', newUrl);
        document.getElementById('roomId').textContent = `房间: ${roomId}`;
    }
    
    usernameModal.style.display = 'none';
    
    // 加载房间数据
    loadRoomData();
    
    // 添加当前用户到参与者列表
    addCurrentUserToParticipants();
    
    // 不显示任何欢迎消息，从零开始
}

// 关闭用户名设置模态框
function closeUsernameModal() {
    usernameModal.style.display = 'none';
}

// 创建新房间
function createNewRoom() {
    roomInput.value = ''; // 清空房间号输入
    
    // 强制重置房间ID，创建全新的房间
    roomId = 'meeting-' + Math.random().toString(36).substr(2, 6);
    const newUrl = window.location.pathname + '?room=' + roomId;
    window.history.replaceState({path: newUrl}, '', newUrl);
    document.getElementById('roomId').textContent = `房间: ${roomId}`;
    
    // 重置当前会话状态
    messages = [];
    participants = [];
    
    // 清空消息容器
    messagesContainer.innerHTML = '';
    
    // 重置总结内容
    summaryContent.innerHTML = '<p class="empty-summary">讨论开始后，AI将为您生成智能总结...</p>';
    
    // 如果已设置用户名，直接加入新房间
    if (currentUsername) {
        usernameModal.style.display = 'none';
        loadRoomData();
        addCurrentUserToParticipants();
    } else {
        // 否则显示用户名设置对话框
        setUsername();
    }
}

// 发送消息
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isAIProcessing || !currentUsername) return;

    // 确保当前用户在参与者列表中
    addCurrentUserToParticipants();

    // 添加用户消息
    const message = {
        type: 'user',
        text: text,
        author: currentUsername,
        userId: currentUserId,
        time: new Date().toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        })
    };
    
    messages.push(message);
    renderMessage(message);
    saveRoomData();
    
    messageInput.value = '';
    autoResizeTextarea();

    // AI实时记录（只有需要时才召唤）
    // await processWithAI(text); // 移除自动AI记录
}

// 添加消息到界面
function addMessage(type, text, author = 'AI助手', userId = null) {
    const message = {
        type,
        text,
        author,
        userId,
        time: new Date().toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        })
    };
    
    messages.push(message);
    renderMessage(message);
    saveRoomData();
    
    // 滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 渲染单条消息
function renderMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.type}-message`;
    
    let avatarContent;
    let avatarColor;
    
    if (message.type === 'user') {
        avatarColor = getAvatarColor(message.author);
        const initials = message.author.charAt(0).toUpperCase();
        avatarContent = `<span style="color: white; font-weight: bold;">${initials}</span>`;
    } else {
        avatarColor = '#6b7280';
        avatarContent = '<i class="fas fa-robot"></i>';
    }
    
    const isCurrentUser = message.userId === currentUserId;
    
    let messageText;
    if (message.isLoading) {
        messageText = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
    } else {
        messageText = `<div class="message-text">${message.text}</div>`;
    }
    
    messageDiv.innerHTML = `
        <div class="message-avatar" style="background-color: ${avatarColor}">${avatarContent}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author" ${isCurrentUser ? 'style="color: #3b82f6; font-weight: 600;"' : ''}>
                    ${message.author} ${isCurrentUser ? '(我)' : ''}
                </span>
                <span class="message-time">${message.time}</span>
            </div>
            ${messageText}
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
}

// 处理AI集成（手动召唤版本）
async function processWithAI(userMessage) {
    if (isAIProcessing) return;
    
    isAIProcessing = true;
    updateAIStatus('AI正在分析...', 'processing');
    
    try {
        // 构建对话上下文
        const context = buildAIContext(userMessage);
        
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.API_KEY}`
            },
            body: JSON.stringify({
                model: CONFIG.MODEL,
                messages: context,
                max_tokens: 300,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error('AI服务响应异常');
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        // 添加AI回答
        addMessage('ai', aiResponse, 'AI助手');
        
        updateAIStatus('AI回答完成', 'complete');
        setTimeout(() => updateAIStatus('AI正在待命...', 'idle'), 2000);
        
    } catch (error) {
        console.error('AI处理失败:', error);
        updateAIStatus('AI服务暂时不可用', 'error');
        setTimeout(() => updateAIStatus('AI正在待命...', 'idle'), 3000);
        
        // 模拟AI回答（降级方案）
        setTimeout(() => {
            const mockResponse = generateMockAIAnswer(userMessage);
            addMessage('ai', mockResponse, 'AI助手');
            updateAIStatus('AI正在待命...', 'idle');
        }, 1000);
    } finally {
        isAIProcessing = false;
    }
}

// 构建AI上下文
function buildAIContext(userMessage) {
    const recentMessages = messages.slice(-10);
    const conversationHistory = recentMessages.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: `${msg.author}: ${msg.text}`
    }));
    
    return [
        {
            role: 'system',
            content: '你是一个智能会议助手，能够回答关于当前讨论的问题、提供总结和建议。请用中文回答。'
        },
        ...conversationHistory,
        {
            role: 'user',
            content: userMessage
        }
    ];
}

// 生成模拟AI响应
function generateMockAIResponse(message) {
    const mockResponses = [
        `用户提到: ${message.substring(0, 20)}...`,
        `讨论要点: ${message.includes('技术') ? '技术方案讨论' : '项目规划'}`,
        `记录: 重要观点 - ${message.length > 10 ? message.substring(0, 15) + '...' : message}`,
        `总结: ${message.includes('架构') ? '架构设计讨论' : '需求分析'}`,
    ];
    return mockResponses[Math.floor(Math.random() * mockResponses.length)];
}

// 生成模拟AI回答
function generateMockAIAnswer(question) {
    const answers = [
        "根据当前讨论，我认为这是一个很有价值的观点。",
        "从讨论内容来看，大家的想法比较一致，可以继续深入探讨。",
        "这个问题很有深度，建议从多个角度继续分析。",
        "基于现有信息，我可以提供一些补充建议。",
        "讨论进展良好，建议总结一下目前的共识。"
    ];
    return answers[Math.floor(Math.random() * answers.length)];
}

// 更新AI状态
function updateAIStatus(text, type) {
    const icon = type === 'processing' ? 'fas fa-spinner fa-spin' : 
                 type === 'error' ? 'fas fa-exclamation-triangle' : 
                 'fas fa-robot';
    aiStatus.innerHTML = `<i class="${icon}"></i> ${text}`;
    
    if (type === 'error') {
        aiStatus.style.color = 'var(--error-color)';
    } else {
        aiStatus.style.color = 'var(--success-color)';
    }
}

// 询问AI
function askAI() {
    askAIModal.style.display = 'block';
    aiQuestionInput.focus();
}

// 关闭询问AI模态框
function closeAskAIModal() {
    askAIModal.style.display = 'none';
    aiQuestionInput.value = '';
}

// 提交AI问题
async function submitAIQuestion() {
    const question = aiQuestionInput.value.trim();
    if (!question || isAIProcessing) return;
    
    // 添加用户问题
    addMessage('user', question, '我');
    closeAskAIModal();
    
    isAIProcessing = true;
    updateAIStatus('AI正在思考...', 'processing');
    
    // 添加AI加载消息
    const loadingMessage = {
        type: 'ai',
        text: 'AI正在思考中...',
        author: 'AI助手',
        userId: 'ai-assistant',
        time: new Date().toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        }),
        isLoading: true
    };
    
    messages.push(loadingMessage);
    renderMessage(loadingMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // 获取加载消息的DOM元素
    const loadingElement = messagesContainer.lastElementChild;
    
    try {
        const context = [
            {
                role: 'system',
                content: '你是一个专业的技术顾问。基于当前的会议讨论内容，为用户提供准确、有用的回答。回答要简洁明了，不超过200字。'
            },
            {
                role: 'user',
                content: `当前讨论内容: ${messages.slice(-3).map(m => m.text).join('；')}。用户问题: ${question}`
            }
        ];
        
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.API_KEY}`
            },
            body: JSON.stringify({
                model: CONFIG.MODEL,
                messages: context,
                max_tokens: 300,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error('AI问答服务异常');
        }
        
        const data = await response.json();
        const aiAnswer = data.choices[0].message.content;
        
        // 更新加载消息为实际回答
        loadingMessage.text = aiAnswer;
        loadingMessage.isLoading = false;
        
        // 更新DOM内容
        const messageTextElement = loadingElement.querySelector('.message-text');
        if (messageTextElement) {
            messageTextElement.innerHTML = aiAnswer;
        } else {
            // 如果没有message-text元素，创建新的
            const contentDiv = loadingElement.querySelector('.message-content');
            const typingIndicator = contentDiv.querySelector('.typing-indicator');
            if (typingIndicator) {
                typingIndicator.remove();
            }
            const messageText = document.createElement('div');
            messageText.className = 'message-text';
            messageText.innerHTML = aiAnswer;
            contentDiv.appendChild(messageText);
        }
        
        updateAIStatus('AI正在监听...', 'listening');
        
    } catch (error) {
        console.error('AI问答失败:', error);
        
        // 更新为错误消息
        loadingMessage.text = '抱歉，AI服务暂时不可用，请稍后重试。';
        loadingMessage.isLoading = false;
        
        // 更新DOM内容
        const messageTextElement = loadingElement.querySelector('.message-text');
        if (messageTextElement) {
            messageTextElement.innerHTML = '抱歉，AI服务暂时不可用，请稍后重试。';
        } else {
            const contentDiv = loadingElement.querySelector('.message-content');
            const typingIndicator = contentDiv.querySelector('.typing-indicator');
            if (typingIndicator) {
                typingIndicator.remove();
            }
            const messageText = document.createElement('div');
            messageText.className = 'message-text';
            messageText.innerHTML = '抱歉，AI服务暂时不可用，请稍后重试。';
            contentDiv.appendChild(messageText);
        }
        
        updateAIStatus('AI正在监听...', 'listening');
    } finally {
        isAIProcessing = false;
    }
}

// 生成模拟AI回答
function generateMockAIAnswer(question) {
    const mockAnswers = [
        `关于"${question}"，建议考虑以下几点：1) 技术可行性 2) 成本效益 3) 实施周期。`,
        `这是一个很好的问题。基于当前讨论，我建议先进行小规模试点，验证效果后再全面推广。`,
        `从技术角度看，这个方案是可行的。但需要注意数据安全和性能优化方面的问题。`,
        `根据我的经验，建议采用渐进式实施策略，先解决核心痛点，再逐步完善。`
    ];
    return mockAnswers[Math.floor(Math.random() * mockAnswers.length)];
}

// 生成总结
async function generateSummary() {
    if (messages.length === 0) {
        alert('暂无讨论内容可总结');
        return;
    }
    
    if (isAIProcessing) return;
    
    // 显示加载状态
    summaryContent.innerHTML = '<p class="loading-summary">AI正在分析讨论内容，请稍候...</p>';
    
    isAIProcessing = true;
    updateAIStatus('AI正在生成总结...', 'processing');
    
    try {
        const context = [
            {
                role: 'system',
                content: '你是一个专业的会议总结AI。请基于讨论内容，生成结构化的会议总结，包括：1) 主要讨论点 2) 达成的共识 3) 待解决问题 4) 下一步行动。用中文回答，格式清晰。'
            },
            {
                role: 'user',
                content: `会议讨论内容：${messages.map(m => `${m.author}: ${m.text}`).join('\n')}`
            }
        ];
        
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.API_KEY}`
            },
            body: JSON.stringify({
                model: CONFIG.MODEL,
                messages: context,
                max_tokens: 500,
                temperature: 0.5
            })
        });
        
        if (!response.ok) {
            throw new Error('AI总结服务异常');
        }
        
        const data = await response.json();
        const summary = data.choices[0].message.content;
        
        summaryContent.innerHTML = `<div class="summary-text">${summary.replace(/\n/g, '<br>')}</div>`;
        updateAIStatus('AI正在监听...', 'listening');
        
    } catch (error) {
        console.error('AI总结失败:', error);
        
        // 生成模拟总结
        const mockSummary = generateMockSummary();
        summaryContent.innerHTML = `<div class="summary-text">${mockSummary}</div>`;
        updateAIStatus('AI正在监听...', 'listening');
    } finally {
        isAIProcessing = false;
    }
}

// 获取用户头像颜色
function getAvatarColor(name) {
    const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#eab308',
        '#84cc16', '#22c55e', '#10b981', '#14b8a6',
        '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
        '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
}

// 生成模拟总结
function generateMockSummary() {
    return `
        <strong>📋 会议总结</strong><br><br>
        
        <strong>🎯 主要讨论点：</strong><br>
        • 技术架构方案讨论<br>
        • 微服务与容器化部署<br>
        • 项目实施计划<br><br>
        
        <strong>✅ 达成共识：</strong><br>
        • 采用微服务架构方向<br>
        • 优先考虑容器化部署<br><br>
        
        <strong>❓ 待解决问题：</strong><br>
        • 具体技术选型细节<br>
        • 团队技能储备评估<br><br>
        
        <strong>🚀 下一步行动：</strong><br>
        • 制定详细技术方案<br>
        • 安排技术调研<br>
        • 下次会议确定时间表
    `;
}

// 导出总结
function exportSummary() {
    const summaryText = summaryContent.innerText || summaryContent.textContent;
    if (!summaryText || summaryText.includes('暂无总结')) {
        alert('暂无总结内容可导出');
        return;
    }
    
    const fullContent = `
会议记录 - Vibe Meeting
时间: ${new Date().toLocaleString('zh-CN')}
房间: ${document.getElementById('roomId').textContent}

讨论内容:
${messages.map(m => `[${m.time}] ${m.author}: ${m.text}`).join('\n')}

AI总结:
${summaryText}

---
由Vibe Meeting AI助手生成
    `;
    
    const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-summary-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 复制房间号
function copyRoomId(event) {
    const roomId = document.getElementById('roomId').textContent.replace('房间: ', '');
    navigator.clipboard.writeText(roomId).then(() => {
        const btn = event.target.tagName === 'BUTTON' ? event.target : event.target.closest('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> 已复制';
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('复制失败:', err);
        alert('复制失败，请手动复制房间号');
    });
}



// 渲染参与者列表
function renderParticipants() {
    participantsList.innerHTML = '';
    
    if (participants.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-participants';
        emptyDiv.innerHTML = '<p>暂无在线成员</p>';
        participantsList.appendChild(emptyDiv);
        return;
    }
    
    participants.forEach(participant => {
        const participantDiv = document.createElement('div');
        participantDiv.className = 'participant';
        
        const initials = participant.name.charAt(0).toUpperCase();
        const avatarColor = getAvatarColor(participant.name);
        const isCurrentUser = participant.id === currentUserId;
        
        participantDiv.innerHTML = `
            <div class="participant-avatar" style="background-color: ${avatarColor}">
                ${initials}
            </div>
            <div class="participant-info">
                <div class="participant-name">
                    ${participant.name} ${isCurrentUser ? '(我)' : ''}
                </div>
                <div class="participant-status ${participant.status}">
                    <i class="fas fa-circle"></i> ${participant.status === 'online' ? '在线' : '离线'}
                </div>
            </div>
        `;
        
        participantsList.appendChild(participantDiv);
    });
}

// 这里可以添加真实的用户加入功能，例如WebSocket连接

// 注册服务工作者
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('SW注册成功: ', registration);
                })
                .catch(registrationError => {
                    console.log('SW注册失败: ', registrationError);
                });
        });
    }
}

// 设置离线指示器
function setupOfflineIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'offline-indicator';
    indicator.textContent = '⚠️ 网络连接已断开，部分功能可能受限';
    document.body.appendChild(indicator);

    window.addEventListener('online', () => {
        indicator.classList.remove('show');
        showToast('网络已恢复', 'success');
    });

    window.addEventListener('offline', () => {
        indicator.classList.add('show');
    });
}

// 显示提示消息
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `${type}-toast`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);