// Фоновый скрипт для управления расширением
chrome.runtime.onInstalled.addListener(() => {
    console.log('🔑 Ключи и Подписки установлены!');
});

// Можем добавить обработчик сообщений от content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "keywordFound") {
        console.log('🔊 Ключевое слово найдено на странице:', request.url);
    }
});