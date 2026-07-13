// 模型路由器 - 任务分流
const ROUTES = {
    chat: 'glm-4-flash',
    reasoning: 'glm-4.7',
    vision: 'glm-4.6v',
    general: 'glm-4.5-air',
    fallback: 'deepseek-v4-flash'
};

let currentLevel = 0;
const FALLBACK_CHAIN = ['glm-4.7', 'glm-4.6v', 'glm-4.5-air', 'deepseek-v4-flash'];

function routeTask(taskType) {
    return ROUTES[taskType] || ROUTES.chat;
}

function getCurrentModel() {
    return FALLBACK_CHAIN[currentLevel] || FALLBACK_CHAIN[FALLBACK_CHAIN.length - 1];
}

function fallback() {
    if (currentLevel < FALLBACK_CHAIN.length - 1) {
        currentLevel++;
        return { model: FALLBACK_CHAIN[currentLevel], message: '降级至 ' + FALLBACK_CHAIN[currentLevel] };
    }
    return { model: FALLBACK_CHAIN[FALLBACK_CHAIN.length - 1], message: '所有通道不可用' };
}

module.exports = { routeTask, getCurrentModel, fallback, ROUTES };
