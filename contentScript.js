// Конфигурация
const KEYWORD = 'ключи';
const DEBOUNCE_TIME = 2000; // Защита от повторного срабатывания (2 секунды)

// Глобальные переменные
let audioContext = null;
let soundBuffer = null;
let lastTriggerTime = 0;
let isAudioReady = false;
let audioInitialized = false;
let isVideoPage = false;

console.log('🔑 Keys And Subscriptions расширение загружено!');

// Проверяем, находимся ли мы на странице просмотра видео
function checkIfVideoPage() {
    const url = window.location.href;
    const isWatchPage = url.includes('/watch?v=');
    const hasVideoPlayer = document.querySelector('video') !== null;
    
    return isWatchPage && hasVideoPlayer;
}

// Основная функция инициализации
function init() {
    console.log('🎯 Начинаем инициализацию расширения...');
    
    // Проверяем, что мы на странице видео
    isVideoPage = checkIfVideoPage();
    
    if (!isVideoPage) {
        console.log('⏸️ Это не страница просмотра видео. Расширение отключено.');
        return;
    }
    
    console.log('✅ Это страница просмотра видео. Запускаем расширение...');
    
    // Загружаем аудиофайл
    loadAudioFile();
    
    // Начинаем наблюдение за субтитрами
    startObserving();
    
    // Активируем аудио по клику (требование браузера)
    setupAudioActivation();
    
    // Следим за сменой видео (SPA навигация в YouTube)
    observePageChanges();
}

// Загрузка аудиофайла
function loadAudioFile() {
    console.log('🔊 Загружаем аудиофайл...');
    
    const soundUrl = browser.runtime.getURL('keys.mp3');
    // для остальных const soundUrl = chrome.runtime.getURL('keys.mp3');
    // для firefox (уже) const soundUrl = browser.runtime.getURL('keys.mp3');
    
    fetch(soundUrl)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.arrayBuffer();
        })
        .then(arrayBuffer => {
            console.log('✅ Аудиофайл загружен');
            soundBuffer = arrayBuffer;
            isAudioReady = true;
        })
        .catch(error => console.error('❌ Ошибка загрузки аудио:', error));
}

function getResourceURL(path) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        return chrome.runtime.getURL(path);
    } else if (typeof browser !== 'undefined' && browser.runtime) {
        return browser.runtime.getURL(path);
    }
    return path;
}

function initAudioContext() {
    if (audioInitialized) return;
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('✅ AudioContext создан');
        
        // Декодируем аудиобуфер
        if (soundBuffer && soundBuffer instanceof ArrayBuffer) {
            audioContext.decodeAudioData(soundBuffer)
                .then(decodedBuffer => {
                    soundBuffer = decodedBuffer;
                    console.log('✅ Аудиобуфер декодирован');
                    audioInitialized = true;
                })
                .catch(error => {
                    console.error('❌ Ошибка декодирования аудио:', error);
                });
        } else {
            console.log('⚠️ soundBuffer еще не готов или уже декодирован');
            audioInitialized = true; // Возможно буфер уже готов
        }
    } catch (error) {
        console.error('❌ Ошибка создания AudioContext:', error);
    }
}

// Воспроизведение звука
function playSound() {
    const now = Date.now();
    
    // Проверяем защиту от повторного срабатывания
    if (now - lastTriggerTime < DEBOUNCE_TIME) {
        console.log('⏸️ Звук не воспроизведен: защита от спама');
        return;
    }
    
    // Если аудио еще не инициализировано, пробуем инициализировать и воспроизвести
    if (!audioInitialized) {
        if (isAudioReady && !audioContext) {
            console.log('🔄 Аудио готово, но контекст не инициализирован. Пытаемся инициализировать...');
            initAudioContext();
            
            // Даем немного времени на инициализацию
            setTimeout(() => {
                if (audioInitialized) {
                    actuallyPlaySound();
                } else {
                    console.log('❌ Не удалось инициализировать аудио вовремя');
                }
            }, 100);
        } else {
            console.log('❌ Аудио не готово к воспроизведению');
        }
        return;
    }
    
    if (audioContext.state === 'suspended') {
        console.log('⚠️ AudioContext приостановлен, пытаемся возобновить...');
        audioContext.resume().then(() => {
            console.log('✅ AudioContext возобновлен');
            actuallyPlaySound();
        });
    } else {
        actuallyPlaySound();
    }
}

// Непосредственное воспроизведение
function actuallyPlaySound() {
    try {
        const source = audioContext.createBufferSource();
        source.buffer = soundBuffer;
        source.connect(audioContext.destination);
        source.start(0);
        
        lastTriggerTime = Date.now();
        console.log('🔊 Звук "КЛЮЧИ И ПОДПИСКИ" воспроизведен!');
        
        source.onended = () => {
            console.log('✅ Воспроизведение завершено');
        };
    } catch (error) {
        console.error('❌ Ошибка воспроизведения:', error);
    }
}

// Поиск субтитров YouTube на странице видео
function findSubtitles() {
    // Только если мы на странице видео
    if (!isVideoPage) return [];
    
    console.log('🔍 Ищем субтитры на странице видео...');
    
    // Селекторы специфичные для страницы просмотра
    const selectors = [
        // Субтитры в плеере
        '.ytp-caption-segment',
        '.captions-text',
        // Транскрипция
        'ytd-transcript-segment-renderer #content-text',
        'ytd-transcript-segment-renderer span',
        // Субтитры в новом дизайне
        '[class*="caption-visual-line"]',
        '[id*="caption-container"]',
        // Общие селекторы для текста субтитров
        'span[role="caption"]',
        '.caption-window span'
    ];
    
    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            console.log(`✅ Нашли элементы субтитров: ${selector} (${elements.length} элементов)`);
            return Array.from(elements);
        }
    }
    
    return [];
}

// Проверка текста на ключевое слово
function checkTextForKeyword(text) {
    if (!text || typeof text !== 'string') return false;
    
    const cleanText = text.toLowerCase().trim();
    const words = cleanText.split(/\s+/);
    
    return words.some(word => 
        word.includes(KEYWORD) || 
        word === KEYWORD ||
        word.startsWith(KEYWORD) ||
        word.endsWith(KEYWORD)
    );
}

// Наблюдение за изменениями DOM
function startObserving() {
    console.log('👀 Начинаем наблюдение за субтитрами...');
    
    const observer = new MutationObserver((mutations) => {
        // Проверяем только если мы на странице видео
        if (!isVideoPage) return;
        
        let shouldCheck = false;
        
        for (const mutation of mutations) {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
                // Проверяем, относятся ли изменения к субтитрам
                if (isSubtitleRelated(mutation)) {
                    shouldCheck = true;
                    break;
                }
            }
        }
        
        if (shouldCheck) {
            checkForKeyword();
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });
    
    // Периодическая проверка (на случай если observer пропустит)
    setInterval(() => {
        if (isVideoPage) {
            checkForKeyword();
        }
    }, 1000);
}

// Проверяем, относится ли мутация к субтитрам
function isSubtitleRelated(mutation) {
    const target = mutation.target;
    
    // Проверяем классы и атрибуты, связанные с субтитрами
    if (target.classList) {
        const classList = Array.from(target.classList);
        if (classList.some(cls => 
            cls.includes('caption') || 
            cls.includes('subtitle') ||
            cls.includes('transcript')
        )) {
            return true;
        }
    }
    
    // Проверяем родительские элементы
    let parent = target.parentElement;
    while (parent) {
        if (parent.classList) {
            const parentClasses = Array.from(parent.classList);
            if (parentClasses.some(cls => 
                cls.includes('caption') || 
                cls.includes('subtitle') ||
                cls.includes('transcript')
            )) {
                return true;
            }
        }
        parent = parent.parentElement;
    }
    
    return false;
}

// Проверка на ключевое слово
function checkForKeyword() {
    if (!isVideoPage) return;
    if (!isAudioReady) return;
    
    const subtitleElements = findSubtitles();
    
    for (const element of subtitleElements) {
        const text = element.textContent;
        if (text && checkTextForKeyword(text)) {
            console.log(`🎯 Нашли ключевое слово "${KEYWORD}" в тексте: "${text}"`);
            playSound();
            return;
        }
    }
}

// Следим за сменой страниц (SPA навигация в YouTube)
function observePageChanges() {
    let currentUrl = window.location.href;
    
    setInterval(() => {
        const newUrl = window.location.href;
        if (newUrl !== currentUrl) {
            console.log('🔄 Обнаружена смена URL');
            currentUrl = newUrl;
            
            // Перепроверяем тип страницы
            const wasVideoPage = isVideoPage;
            isVideoPage = checkIfVideoPage();
            
            if (!wasVideoPage && isVideoPage) {
                console.log('✅ Перешли на страницу видео');
            } else if (wasVideoPage && !isVideoPage) {
                console.log('❌ Ушли со страницы видео');
            }
        }
    }, 1000);
}

// Активация аудио по клику
function setupAudioActivation() {
    document.addEventListener('click', function audioActivation() {
        if (!audioContext && isAudioReady && isVideoPage) {
            console.log('🎵 Пользователь кликнул, активируем аудио...');
            initAudioContext();
            document.removeEventListener('click', audioActivation);
        }
    });
}

// Запускаем когда DOM готов
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}