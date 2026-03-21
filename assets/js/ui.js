        // ==================================================
        // 9. [수정] 던전 탐색 (오라 카드 & 애니메이션 시스템)
        // ==================================================
        // 기존 startDungeonExploration 함수 내부 수정
        function startDungeonExploration(dungeonId) {
            const dungeon = state.dungeons.find(d => d.id === dungeonId);
            if (!dungeon) return;

            state.dungeonRun = {
                dungeonId: dungeonId,
                name: dungeon.name,
                theme: DUNGEON_THEMES[dungeon.themeId],
                progress: 0,
                cards: [],
                log: "미궁의 입구에 들어섰습니다. 어둠 속에서 알 수 없는 기운이 흘러나옵니다.",
                isResolving: false,
                currentTab: 'explore',
                // 💡 아래 한 줄을 추가해 주세요 (인덱스 5번이 전열 정중앙입니다)
                formation: [null, null, null, null, null, 'player', null, null, null]
            };

            generateDungeonCards();
            state.screen = 'dungeon_explore';
            render();
        }

        // 개별 카드 HTML 생성 함수
        function generateCardHtml(card, index) {
            const frontIcon = card.realColor === 'rose' ? '⚔️' : card.realColor === 'amber' ? '💰' : card.realColor === 'emerald' ? '🍃' : '✨';
            const backGlowClass = `card-glow-${card.displayColor} intensity-${card.intensity}`;

            return `
                <div id="card-${card.id}" onclick="resolveDungeonCard(${index})" class="dungeon-card ${card.isRevealed ? 'flipped' : ''} shadow-2xl">
                    <div class="card-face card-back ${backGlowClass} relative group">
                        <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjMGYxNzJhIj48L3JlY3Q+CjxwYXRoIGQ9Ik0wIDBMOCA4Wk04IDBMMCA4WiIgc3Ryb2tlPSIjMWUyOTNiIiBzdHJva2Utd2lkdGg9IjEiPjwvcGF0aD4KPC9zdmc+')] opacity-40 rounded-xl"></div>
                        <div class="absolute bottom-6 text-xs font-bold text-slate-400 tracking-widest uppercase opacity-50 transition-opacity group-hover:opacity-100">에테리아 연대기</div>
                    </div>
                    
                    <div class="card-face card-front border-${card.realColor}-500 flex flex-col items-center justify-center">
                        <div class="text-5xl mb-4 drop-shadow-lg">${frontIcon}</div>
                        <h3 class="text-xl font-bold text-${card.realColor}-400 mb-2">${card.title}</h3>
                        <p class="text-sm text-slate-300 flex-1 flex items-center">${card.desc}</p>
                        <div class="mt-auto text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1.5 rounded-full shadow-inner">탐색 진행도 +${card.progress}%</div>
                    </div>
                </div>
            `;
        }

        // 카드 클릭 처리 함수
        // 카드 클릭 처리 함수
        function resolveDungeonCard(index) {
            if (state.dungeonRun.isResolving) return;

            const run = state.dungeonRun;
            let card = run.cards[index];
            if (card.isRevealed) return;

            run.isResolving = true;

            const cardEl = document.getElementById(`card-${card.id}`);
            if (cardEl) {
                cardEl.classList.add('flipped');
            }

            card.isRevealed = true;
            card.displayColor = card.realColor;

            run.progress = Math.min(100, run.progress + card.progress);
            const progressBarEl = document.getElementById('dungeon-progress-bar');
            const progressTextEl = document.getElementById('dungeon-progress-text');
            if (progressBarEl) progressBarEl.style.width = `${run.progress}%`;
            if (progressTextEl) progressTextEl.innerText = `탐색 진행도: ${run.progress}%`;

            // 💡 카드 뒤집기 애니메이션이 깔끔하게 끝날 때까지 대기 (600ms)
            setTimeout(() => {
                // 💡 [여기에 추가] 카드가 몬스터일 경우 즉시 전투 로직으로 넘어갑니다.
                if (card.type === 'monster') {
                    showToast(`⚔️ [전투 발생] ${run.theme.monsters[0]} 무리와 마주쳤습니다!`);
                    setTimeout(() => {
                        startDungeonCombat();
                    }, 1000);
                    return;
                }

                // --- 이 아래부터는 기존 코드와 동일합니다 ---
                let logMsg = "";
                if (card.type === 'item') logMsg = `💰 [아이템 획득] 낡은 상자에서 전리품을 챙겼습니다.`;
                else if (card.type === 'rest') logMsg = `🍃 [휴식] 파티가 잠시 휴식을 취하며 체력을 회복합니다.`;
                else if (card.type === 'boss') {
                    showToast("최심부 보스전은 다음 업데이트에 구현됩니다! (던전 클리어 처리)");
                    let d = state.dungeons.find(d => d.id === run.dungeonId);
                    if (d) d.cleared = true;
                    state.screen = 'world';
                    render();
                    return;
                } else logMsg = `✨ [특수 이벤트] ${card.title} - 진행도가 대폭 상승합니다!`;

                run.log = logMsg;
                showToast(logMsg);

                const logEl = document.getElementById('dungeon-log-text');
                if (logEl) {
                    logEl.innerText = logMsg;
                    logEl.classList.remove('animate-fade-in');
                    void logEl.offsetWidth;
                    logEl.classList.add('animate-fade-in');
                }

                // 💡 유저가 뒤집힌 카드의 결과(앞면)를 충분히 읽고 인지한 뒤에 새 카드가 깔리도록 시간 연장 (1500ms)
                setTimeout(() => {
                    generateDungeonCards();

                    const cardsContainerEl = document.getElementById('dungeon-cards-container');
                    if (cardsContainerEl) {
                        cardsContainerEl.innerHTML = run.cards.map((c, idx) => generateCardHtml(c, idx)).join('');
                        cardsContainerEl.classList.remove('animate-fade-in');
                        void cardsContainerEl.offsetWidth;
                        cardsContainerEl.classList.add('animate-fade-in');
                    }
                    run.isResolving = false;
                }, 1500);

            }, 600);
        }
        // generateDungeonCards 함수는 데이터만 생성하도록 수정 (기존 함수 내용을 아래처럼 변경)
        function generateDungeonCards() {
            // 보스방 도달 시
            if (state.dungeonRun.progress >= 100) {
                state.dungeonRun.cards = [{
                    type: 'boss',
                    realColor: 'purple',
                    displayColor: 'purple',
                    intensity: 3,
                    title: '심연의 주인',
                    desc: '미궁의 가장 깊은 곳, 보스의 기운이 압도적으로 뿜어져 나옵니다.',
                    progress: 0,
                    isRevealed: false
                }];
                // 💡 render() 호출을 삭제했습니다.
                return;
            }

            let newCards = [];
            const pTraits = state.player.traits || [];
            const canReadMind = pTraits.includes('mind_reader');

            for (let i = 0; i < 3; i++) {
                let r = Math.random();
                let type, color, progress, title, desc;
                let intensity = Math.random() > 0.8 ? 3 : (Math.random() > 0.4 ? 2 : 1);

                if (Math.random() < 0.1 && i === 1) {
                    if (pTraits.includes('berserker') && Math.random() < 0.5) {
                        type = 'special_blood';
                        color = 'rose';
                        intensity = 3;
                        title = '피의 제단';
                        desc = '체력을 제물로 바쳐 강력한 힘을 얻습니다.';
                        progress = 15;
                    } else if (pTraits.includes('master_crafter')) {
                        type = 'special_forge';
                        color = 'amber';
                        intensity = 2;
                        title = '잊혀진 모루';
                        desc = '장비를 강화할 수 있는 고대의 대장간입니다.';
                        progress = 10;
                    } else if (pTraits.includes('animal_friend')) {
                        type = 'special_beast';
                        color = 'emerald';
                        intensity = 2;
                        title = '온순한 마수';
                        desc = '적대적이지 않은 길잃은 마수를 만났습니다.';
                        progress = 15;
                    } else {
                        type = 'special_rune';
                        color = 'purple';
                        intensity = 3;
                        title = '빛나는 룬 석판';
                        desc = '던전의 비밀이 담긴 석판입니다.';
                        progress = 25;
                    }
                } else {
                    if (r < 0.5) {
                        type = 'monster';
                        color = 'rose';
                        progress = intensity * 2;
                        title = intensity === 3 ? '치명적인 마물 조우' : '몬스터 무리';
                        desc = '피비린내가 진동합니다. 무기를 꺼내십시오.';
                    } else if (r < 0.8) {
                        type = 'item';
                        color = 'amber';
                        progress = intensity * 1;
                        title = intensity === 3 ? '고대의 보물상자' : '떨어진 유품';
                        desc = '어둠 속에서 금빛이 은은하게 새어나옵니다.';
                    } else {
                        type = 'rest';
                        color = 'emerald';
                        progress = intensity * 1;
                        title = '안전한 성소';
                        desc = '적의 기척이 없습니다. 잠시 숨을 돌릴 수 있습니다.';
                    }
                }

                let isHidden = false;
                if (!canReadMind && Math.random() < 0.3) {
                    isHidden = true;
                }

                newCards.push({
                    id: 'card_' + Date.now() + i,
                    type: type,
                    realColor: color,
                    displayColor: isHidden ? 'slate' : color,
                    intensity: intensity,
                    title: title,
                    desc: desc,
                    progress: progress,
                    isRevealed: false
                });
            }
            state.dungeonRun.cards = newCards;
            // 💡 render() 호출을 삭제했습니다.
        }

function renderDungeonExplore() {
    const run = state.dungeonRun;

    const tabsHtml = `
        <div class="flex space-x-2 border-b border-slate-700 mb-6 pb-2 w-full justify-center">
            <button class="dungeon-tab-btn px-6 py-2 rounded-t-lg font-bold text-sm transition-colors ${run.currentTab === 'explore' ? 'bg-rose-700 text-white shadow-inner' : 'text-slate-400 hover:bg-slate-800'}" data-tab="explore">🔍 탐색</button>
            <button class="dungeon-tab-btn px-6 py-2 rounded-t-lg font-bold text-sm transition-colors ${run.currentTab === 'formation' ? 'bg-indigo-600 text-white shadow-inner' : 'text-slate-400 hover:bg-slate-800'}" data-tab="formation">🛡️ 파티 진형</button>
            <button class="dungeon-tab-btn px-6 py-2 rounded-t-lg font-bold text-sm transition-colors ${run.currentTab === 'info' ? 'bg-emerald-600 text-white shadow-inner' : 'text-slate-400 hover:bg-slate-800'}" data-tab="info">📜 던전 정보</button>
        </div>
    `;

    let contentHtml = '';
    if (run.currentTab === 'explore') {
        let cardsHtml = run.cards.map((card, idx) => generateCardHtml(card, idx)).join('');
        contentHtml = `
            <div class="w-full bg-slate-800 rounded-full h-3 mb-3 border border-slate-700 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] overflow-hidden relative">
                <div id="dungeon-progress-bar" class="bg-gradient-to-r from-blue-600 via-purple-500 to-rose-500 h-3 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_var(--tw-gradient-stops)]" style="width: ${run.progress}%"></div>
            </div>
            <div id="dungeon-progress-text" class="text-right text-sm font-bold text-purple-300 mb-8 tracking-wider drop-shadow-md">탐색 진행도: ${run.progress}%</div>
            <div id="dungeon-cards-container" class="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-10 flex-1 min-h-[400px]">
                ${cardsHtml}
            </div>
            <div class="mt-8 bg-black/60 p-5 rounded-xl border border-slate-700/50 text-center min-h-[66px] flex items-center justify-center backdrop-blur-sm shadow-2xl relative">
                <div class="absolute inset-0 bg-slate-900 rounded-xl opacity-30 shadow-[inset_0_0_20px_rgba(0,0,0,0.6)]"></div>
                <p id="dungeon-log-text" class="text-slate-200 font-bold text-lg animate-fade-in relative z-10">${run.log}</p>
            </div>
        `;
    } else if (run.currentTab === 'formation') {
        let formationSlotsHtml = '';
        for (let i = 0; i < 9; i++) {
            let isPlayer = (run.formation[i] === 'player');
            let colIndex = i % 3;
            let positionText = colIndex === 0 ? '후열' : (colIndex === 1 ? '중열' : '전열');

            formationSlotsHtml += `
                <div class="h-24 bg-slate-900 border border-slate-600 border-dashed hover:border-blue-400 rounded-lg flex flex-col items-center justify-center transition-colors relative drop-zone" data-slot-index="${i}">
                    <div class="absolute top-1 left-1 text-[10px] font-bold text-slate-500">${positionText}</div>
                    ${isPlayer ? `
                    <div class="w-full h-full flex flex-col items-center justify-center cursor-grab active:cursor-grabbing hover:bg-indigo-900/30 rounded-lg border-2 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)] transition-all" draggable="true">
                        <span class="text-2xl mb-1 drop-shadow-md">👤</span>
                        <span class="text-sm font-bold text-indigo-300">${state.player.name}</span>
                    </div>
                    ` : `<span class="text-xl text-slate-600 opacity-50">+</span>`}
                </div>
            `;
        }

        contentHtml = `
            <div class="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl p-6 flex flex-col items-center animate-fade-in min-h-[400px]">
                <h3 class="text-2xl font-bold text-white mb-2 flex items-center"><span class="text-indigo-400 mr-2">🛡️</span> 파티 진형 세팅 (3x3)</h3>
                <p class="text-slate-400 text-sm mb-6 text-center">전투 돌입 시 이 배치에 따라 위치가 결정되며, 적군의 광역/관통 공격에 영향을 받습니다.<br><span class="text-blue-300 font-bold">※ 전투는 각 캐릭터의 '민첩(속도)'에 따른 행동 게이지(턴) 시스템으로 진행됩니다.</span></p>
                <div class="flex flex-col md:flex-row w-full max-w-4xl gap-6">
                    <div class="flex-1 bg-blue-950/30 p-5 rounded-xl border border-blue-900/50 shadow-inner">
                        <div class="text-center text-rose-400 font-bold mb-4 text-sm flex items-center justify-center tracking-widest">
                            적진 방향 (전열) <span class="ml-2 text-lg">▶</span>
                        </div>
                        <div id="formation-grid" class="grid grid-cols-3 gap-3">
                            ${formationSlotsHtml}
                        </div>
                    </div>
                    <div class="w-full md:w-1/3 bg-slate-900/80 p-5 rounded-xl border border-slate-700 flex flex-col">
                        <h4 class="text-sm font-bold text-slate-300 mb-3 border-b border-slate-600 pb-2 flex justify-between items-center">
                            <span>편성 대기열</span>
                            <span class="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-600">Drag & Drop</span>
                        </h4>
                        <div class="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-600 rounded-lg p-4 min-h-[150px]">
                            <span class="text-xs text-slate-500 text-center leading-relaxed">아직 영입한 동료나<br>고용된 용병이 없습니다.</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (run.currentTab === 'info') {
        contentHtml = `
            <div class="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl p-6 animate-fade-in min-h-[400px]">
                <h3 class="text-xl font-bold text-rose-400 mb-6 border-b border-slate-700 pb-2 flex items-center"><span class="mr-2">${run.theme.icon}</span> ${run.name} 환경 정보</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
                    <div class="bg-slate-900 p-5 rounded-lg border border-slate-600 shadow-inner col-span-1 md:col-span-2">
                        <span class="block text-slate-500 font-bold mb-2">던전 기믹 및 환경</span>
                        <p class="leading-relaxed">${run.theme.desc}</p>
                    </div>
                    <div class="bg-slate-900 p-5 rounded-lg border border-slate-600 shadow-inner">
                        <span class="block text-slate-500 font-bold mb-2">출현 예상 마물</span>
                        <p class="text-amber-400 font-bold">${run.theme.monsters.join(', ')}</p>
                    </div>
                    <div class="bg-slate-900 p-5 rounded-lg border border-slate-600 shadow-inner">
                        <span class="block text-slate-500 font-bold mb-2">탐색 현황</span>
                        <p>${run.progress > 0 ? `현재까지 <span class="text-purple-400 font-bold">${run.progress}%</span> 탐색을 완료했습니다.` : '아직 본격적인 탐색을 시작하지 않았습니다.'}</p>
                    </div>
                </div>
            </div>
        `;
    }

    // 💡 변경된 핵심 부분: 큰 껍데기가 이미 있다면 속맹이만 교체합니다.
    let mainContainer = document.getElementById('dungeon-explore-main');
    if (!mainContainer) {
        appEl.innerHTML = `
            <div id="dungeon-explore-main" class="min-h-screen bg-[#0a0f18] flex flex-col items-center justify-start p-8 relative overflow-hidden animate-fade-in">
                <div class="absolute top-0 left-0 w-full h-full pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-[#0a0f18] to-black opacity-80"></div>
                <div class="w-full max-w-6xl z-10 flex flex-col h-full relative">
                    <div class="flex justify-between items-center mb-6 bg-slate-900/80 p-4 rounded-xl border border-slate-700 backdrop-blur-sm shadow-xl shrink-0">
                        <div>
                            <h2 class="text-2xl font-black text-white flex items-center"><span class="text-3xl mr-3">${run.theme.icon}</span> ${run.name}</h2>
                        </div>
                        <button onclick="state.screen='world'; render()" class="px-5 py-2.5 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-200 border border-slate-600 hover:border-rose-700 rounded-lg transition-all text-sm font-bold shadow-md">도망치기 (포기)</button>
                    </div>

                    <div id="dungeon-tabs-container">
                        ${tabsHtml}
                    </div>
                    
                    <div id="dungeon-content-container" class="flex flex-col flex-1 w-full pb-10">
                        ${contentHtml}
                    </div>
                </div>
            </div>
        `;
    } else {
        // 이미 렌더링 된 상태라면 탭과 내용물만 부분 교체 (깜빡임 X)
        document.getElementById('dungeon-tabs-container').innerHTML = tabsHtml;
        document.getElementById('dungeon-content-container').innerHTML = contentHtml;
    }
}

        // ==========================================
        // 8. UI Rendering Helpers & Main Views
        // ==========================================
        function render() {
            if (state.screen === 'boot') renderBootScreen();
            else if (state.screen === 'title') renderTitle();
            else if (state.screen === 'history') renderHistoryLayout();
            else if (state.screen === 'origin') renderOriginLayout();
            else if (state.screen === 'create') renderCharacterCreationLayout();
            else if (state.screen === 'world') renderInGameLayout();
            else if (state.screen === 'dictionary') renderDictionary();
            else if (state.screen === 'dungeon_explore') renderDungeonExplore();
            else if (state.screen === 'dungeon_combat') renderDungeonCombat(); // 💡 이 줄을 새로 추가합니다!
        }

        function renderBootScreen() {
            appEl.innerHTML = `
                <div class="min-h-screen bg-slate-900 p-4 md:p-8 flex flex-col items-center animate-fade-in relative z-10 overflow-y-auto">
                    <div class="w-full max-w-5xl flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
                        <button id="btn-back-title-from-boot" class="order-2 md:order-1 text-slate-400 hover:text-white flex items-center transition-colors font-bold text-lg bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-700">
                            <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                            </svg> 
                            타이틀로 돌아가기
                        </button>
                        
                        <div class="order-1 md:order-2 text-center md:text-right">
                            <h1 class="text-3xl md:text-5xl text-white font-black tracking-widest font-fantasy text-glow">AETHERIA MOD MANAGER</h1>
                            <p class="text-slate-400 text-sm mt-1">외부 데이터 로드 및 게임 설정</p>
                        </div>
                    </div>
                    
                    <div class="w-full max-w-3xl bg-slate-800 p-6 md:p-8 rounded-2xl border border-slate-600 shadow-2xl space-y-8 mb-10">
                        <div class="flex flex-col md:flex-row justify-between items-center border-b border-slate-700 pb-6 gap-4">
                            <div class="text-center md:text-left">
                                <h3 class="text-xl text-white font-bold mb-1">기본 데이터로 시작</h3>
                                <p class="text-sm text-slate-400">내장된 오리지널 게임 설정으로 바로 플레이합니다.</p>
                            </div>
                            <button id="btn-boot-default" class="bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all transform hover:-translate-y-1 text-white px-8 py-3 rounded-lg font-black shrink-0 w-full md:w-auto">기본 플레이</button>
                        </div>
                        
                        <div class="flex flex-col md:flex-row justify-between items-center border-b border-slate-700 pb-6 gap-4">
                            <div class="text-center md:text-left">
                                <h3 class="text-lg text-amber-400 font-bold mb-1 flex items-center justify-center md:justify-start"><span class="mr-2">🛠️</span> 모드 제작용 템플릿 추출</h3>
                                <p class="text-sm text-slate-400">현재 적용된 데이터를 JSON 파일로 다운로드합니다.</p>
                            </div>
                            <button id="btn-export-json" class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 border border-slate-500 rounded font-bold shrink-0 w-full md:w-auto transition-colors">데이터 다운로드</button>
                        </div>

                        <div class="border-b border-slate-700 pb-6">
                            <h3 class="text-lg text-white font-bold mb-1 flex items-center"><span class="mr-2">☁️</span> 클라우드 (URL)에서 불러오기</h3>
                            <p class="text-sm text-slate-400 mb-3">JSON 주소(Raw URL)를 입력하세요.</p>
                            <div class="flex gap-2 flex-col md:flex-row">
                                <input type="text" id="input-mod-url" placeholder="https://raw.githubusercontent.com/..." class="flex-1 bg-slate-900 border border-slate-500 focus:border-indigo-500 outline-none rounded px-4 py-3 text-white text-sm">
                                <button id="btn-load-url" class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded font-bold transition-colors">불러오기</button>
                            </div>
                        </div>

                        <div>
                            <h3 class="text-lg text-white font-bold mb-1 flex items-center"><span class="mr-2">📂</span> 로컬 파일에서 불러오기</h3>
                            <p class="text-sm text-slate-400 mb-3">수정한 JSON 모드 파일을 직접 선택합니다.</p>
                            <div class="relative bg-slate-900 border border-dashed border-slate-500 hover:border-slate-400 rounded-lg p-6 text-center cursor-pointer transition-colors group">
                                <input type="file" id="input-mod-file" accept=".json" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                                <span class="text-slate-400 group-hover:text-white font-bold">클릭하여 파일 선택 (.json)</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        function showToast(message, isAdult = false, options = {}) {
            const variant = options.variant || 'default';
            const durationMs = options.durationMs ?? 2500;
            const fadeOutMs = options.fadeOutMs ?? 800;
            const toast = document.createElement('div');
            if (variant === 'history-log') {
                toast.className = 'fixed top-6 left-0 right-0 w-full px-4 py-1 text-center font-bold text-base md:text-lg text-slate-100 z-50 animate-fade-in pointer-events-none';
                toast.style.textShadow = '0 2px 10px rgba(0, 0, 0, 0.95)';
            } else {
                toast.className = `fixed top-10 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full font-bold shadow-2xl z-50 animate-fade-in border ${isAdult ? 'bg-rose-950 text-rose-200 border-rose-500 text-adult' : 'bg-slate-800 text-white border-slate-600'}`;
            }
            toast.innerText = message;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.classList.replace('animate-fade-in', 'animate-fade-out');
                setTimeout(() => toast.remove(), fadeOutMs);
            }, durationMs);
        }

        function getTierStyles(tier, isDictionary = false) {
            let selected = "border-slate-400 bg-slate-700/50";
            let badge = "bg-slate-600 text-white";
            if (tier === '유일') {
                selected = "border-rose-500 bg-rose-900/40 shadow-[0_0_12px_rgba(244,63,94,0.4)]";
                badge = "bg-rose-600 text-white";
            } else if (tier === '전설') {
                selected = "border-orange-500 bg-orange-900/40 shadow-[0_0_12px_rgba(249,115,22,0.4)]";
                badge = "bg-orange-500 text-white";
            } else if (tier === '영웅') {
                selected = "border-purple-500 bg-purple-900/40 shadow-[0_0_12px_rgba(168,85,247,0.4)]";
                badge = "bg-purple-600 text-white";
            } else if (tier === '희귀') {
                selected = "border-blue-500 bg-blue-900/40 shadow-[0_0_12px_rgba(59,130,246,0.4)]";
                badge = "bg-blue-600 text-white";
            }
            if (isDictionary) selected = selected.replace(/shadow-\[.*?\]/, '');
            return {
                cardClass: selected,
                badgeClass: badge
            };
        }

        function formatBonusText(bonus) {
            if (!bonus) return '';
            let parts = [];
            if (bonus.str) parts.push(`근력 ${bonus.str > 0 ? '+'+bonus.str : bonus.str}`);
            if (bonus.mag) parts.push(`마력 ${bonus.mag > 0 ? '+'+bonus.mag : bonus.mag}`);
            if (bonus.agi) parts.push(`민첩 ${bonus.agi > 0 ? '+'+bonus.agi : bonus.agi}`);
            if (bonus.cha) parts.push(`화술 ${bonus.cha > 0 ? '+'+bonus.cha : bonus.cha}`);
            if (bonus.gold) parts.push(`초기자금 ${bonus.gold > 0 ? '+'+bonus.gold : bonus.gold}G`);
            if (parts.length === 0) return '';
            return `<div class="mt-auto w-full pt-2 border-t border-slate-700/50 text-xs bg-black/20 p-2 rounded"><span class="text-green-400">${parts.join(', ')}</span></div>`;
        }

        function enqueueAction(type, name, cost, data = {}) {
            if (cost <= 0) return;
            if (type !== 'travel') {
                let currentNonTravelCost = 0;
                state.player.actionQueue.forEach(act => {
                    if (act.type !== 'travel') currentNonTravelCost += act.remainingCost;
                });
                if (currentNonTravelCost + cost > TURN_AP) {
                    showToast(`행동 예약 실패: 한 턴 예약 한도(${TURN_AP} AP) 초과.`);
                    return;
                }
            }
            state.player.actionQueue.push({
                id: 'act_' + Date.now() + Math.random(),
                type,
                name,
                cost,
                remainingCost: cost,
                ...data
            });
            renderActionQueueBar();
            showToast(`[예약됨] ${name} (${cost} AP)`);
        }

        function renderActionQueueBar() {
            const barContainer = document.getElementById('action-queue-container');
            if (!barContainer) return;
            const countEl = document.getElementById('action-queue-count');
            if (state.player.actionQueue.length === 0) {
                barContainer.innerHTML = `<div class="text-slate-500 text-xs italic px-3 py-4 text-center">현재 예약된 행동이 없습니다.<br>거점 시설을 선택해 예약하세요.</div>`;
                if (countEl) countEl.textContent = '0';
                return;
            }
            if (countEl) countEl.textContent = String(state.player.actionQueue.length);
            let html = state.player.actionQueue.map((act, idx) => {
                let costStr = `${act.remainingCost} AP`;
                return `
                    <div class="flex items-center justify-between gap-2 bg-slate-800/90 border border-slate-600 rounded-lg px-3 py-2 shadow-md queue-item-active">
                        <div class="flex flex-col min-w-0">
                            <span class="text-[11px] font-bold text-white truncate">${idx + 1}. ${act.name}</span>
                            <span class="text-[10px] text-blue-300">잔여: ${costStr}</span>
                        </div>
                        <button class="text-slate-400 hover:text-rose-400 p-1 shrink-0" data-action="cancel-queue" data-id="${act.id}">✖</button>
                    </div>
                `;
            }).join('');
            barContainer.innerHTML = html;
            const panel = document.getElementById('action-queue-panel');
            if (panel && panel.style.maxHeight && panel.style.maxHeight !== '0px') {
                const maxH = Math.min(panel.scrollHeight, Math.floor(window.innerHeight * 0.6));
                panel.style.maxHeight = `${maxH}px`;
            }
        }

        function renderDebugModalContent() {
            const content = document.getElementById('debug-modal-content');
            if (!content) return;

            // 현재 선택된 탭이 없다면 기본값으로 'logs(사건 일지)' 설정
            if (!debugState.activeTab) debugState.activeTab = 'logs';

            // 💡 1. 상단 탭 네비게이션 메뉴
            let tabsHtml = `
                <div class="flex space-x-2 mb-4 border-b border-slate-700 pb-3 shrink-0">
                    <button onclick="debugState.activeTab='logs'; renderDebugModalContent()" class="px-4 py-2 rounded font-bold text-sm transition-colors ${debugState.activeTab === 'logs' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}">📜 사건 일지</button>
                    <button onclick="debugState.activeTab='npcs'; renderDebugModalContent()" class="px-4 py-2 rounded font-bold text-sm transition-colors ${debugState.activeTab === 'npcs' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}">👥 NPC 동향</button>
                    <button onclick="debugState.activeTab='world'; renderDebugModalContent()" class="px-4 py-2 rounded font-bold text-sm transition-colors ${debugState.activeTab === 'world' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}">🌍 세계 통계</button>
                </div>
            `;

            let mainHtml = '';

            // 💡 2-1. [세계 통계] 탭 내용
            if (debugState.activeTab === 'world') {
                let totalMana = 0;
                let maxMana = 0;
                let maxManaLoc = {
                    x: 0,
                    y: 0
                };

                // 마나 계산
                for (let y = 0; y < MAP_SIZE; y++) {
                    for (let x = 0; x < MAP_SIZE; x++) {
                        let m = state.worldMap[y][x].mana;
                        totalMana += m;
                        if (m > maxMana) {
                            maxMana = m;
                            maxManaLoc = {
                                x,
                                y
                            };
                        }
                    }
                }
                let avgMana = (totalMana / (MAP_SIZE * MAP_SIZE)) * 100; // 백분율(%) 환산

                // 인구 및 문명 계산
                let totalPop = state.settlements.reduce((sum, s) => sum + s.population, 0);
                let topCity = state.settlements.length > 0 ? [...state.settlements].sort((a, b) => b.population - a.population)[0] : null;

                mainHtml = `
                    <div class="space-y-4 text-sm animate-fade-in">
                        <div class="bg-slate-800 p-4 rounded-lg border border-emerald-900/50 shadow-inner">
                            <h4 class="text-emerald-400 font-bold mb-3 border-b border-slate-700 pb-1 flex items-center"><span class="mr-2">✨</span> 마나 통계</h4>
                            <div class="grid grid-cols-2 gap-4">
                                <div><span class="text-slate-400 text-xs block">세계 평균 마나 농도</span><span class="text-white font-bold text-lg">${avgMana.toFixed(2)}%</span></div>
                                <div><span class="text-slate-400 text-xs block">전체 보유 마나량</span><span class="text-white font-bold text-lg">${Math.floor(totalMana).toLocaleString()}</span></div>
                                <div class="col-span-2"><span class="text-slate-400 text-xs block">가장 마나가 짙은 곳</span><span class="text-emerald-300 font-bold">${state.worldMap[maxManaLoc.y][maxManaLoc.x].name}</span> <span class="text-white text-xs">(X:${maxManaLoc.x}, Y:${maxManaLoc.y}) - 농도 ${(maxMana * 100).toFixed(1)}%</span></div>
                            </div>
                        </div>

                        <div class="bg-slate-800 p-4 rounded-lg border border-blue-900/50 shadow-inner">
                            <h4 class="text-blue-400 font-bold mb-3 border-b border-slate-700 pb-1 flex items-center"><span class="mr-2">🏛️</span> 문명 및 인구 통계</h4>
                            <div class="grid grid-cols-2 gap-4">
                                <div><span class="text-slate-400 text-xs block">전 세계 총 인구수</span><span class="text-white font-bold text-lg">${totalPop.toLocaleString()}명</span></div>
                                <div><span class="text-slate-400 text-xs block">형성된 거점(마을/도시) 수</span><span class="text-white font-bold text-lg">${state.settlements.length}개</span></div>
                                <div class="col-span-2"><span class="text-slate-400 text-xs block">가장 번화한 대도시</span><span class="text-blue-300 font-bold">${topCity ? topCity.name : '없음'}</span> <span class="text-white text-xs">${topCity ? `(${topCity.population.toLocaleString()}명, ${SETTLEMENT_TIERS[topCity.type].name})` : ''}</span></div>
                            </div>
                        </div>
                    </div>
                `;
            }
            // 💡 2-2. [사건 일지] 탭 내용
            else if (debugState.activeTab === 'logs') {
                let logsToRender = state.turnLogs || [];
                if (debugState.logRange !== 'all') {
                    logsToRender = logsToRender.slice(0, parseInt(debugState.logRange));
                }

                let logsHtml = `<div class="text-slate-500 text-sm py-10 text-center">아직 기록된 턴 로그가 없습니다. 턴을 진행해보세요.</div>`;
                if (logsToRender.length > 0) {
                    logsHtml = logsToRender.map(logBlock => {
                        let innerLogs = logBlock.logs.length > 0 ? logBlock.logs.map(l => `<div class="text-sm text-slate-300 py-1 border-b border-slate-700/50 break-keep">${l}</div>`).join('') : `<div class="text-sm text-slate-500 py-1">특별한 사건이 없었습니다.</div>`;
                        return `<div class="mb-4 bg-slate-800 rounded p-3 border border-slate-600"><h4 class="text-amber-400 font-bold mb-2 border-b border-slate-700 pb-1">${logBlock.title}</h4>${innerLogs}</div>`;
                    }).join('');
                }

                let logOpts = `<option value="1" ${debugState.logRange==='1'?'selected':''}>최근 1턴만 보기</option><option value="5" ${debugState.logRange==='5'?'selected':''}>최근 5턴 보기</option><option value="all" ${debugState.logRange==='all'?'selected':''}>모든 기록 보기</option>`;

                mainHtml = `
                    <div class="flex flex-col h-full min-h-0 animate-fade-in">
                        <div class="mb-3 flex justify-end shrink-0"><select class="bg-slate-900 text-white border border-slate-600 rounded px-2 py-1 text-xs outline-none" onchange="debugState.logRange=this.value; renderDebugModalContent()">${logOpts}</select></div>
                        <div class="flex-1 overflow-y-auto pr-2 custom-scroll">${logsHtml}</div>
                    </div>
                `;
            }
            // 💡 2-3. [NPC 동향] 탭 내용
            else if (debugState.activeTab === 'npcs') {
                let filteredNPCs = state.npcs.filter(npc => {
                    let passRace = debugState.npcRace === 'all' || npc.race === debugState.npcRace;
                    let passNation = true;
                    if (debugState.npcNation !== 'all') {
                        if (npc.location) {
                            let tile = state.worldMap[npc.location.y][npc.location.x];
                            if (debugState.npcNation === 'none') {
                                passNation = tile.nationId === null;
                            } else {
                                passNation = tile.nationId === parseInt(debugState.npcNation);
                            }
                        } else {
                            passNation = false;
                        }
                    }
                    return passRace && passNation;
                });

                let npcsHtml = filteredNPCs.map(npc => {
                    let locStr = npc.location ? `(X:${npc.location.x}, Y:${npc.location.y})` : '위치 불명';
                    let actStr = (npc.actionQueue && npc.actionQueue.length > 0) ? `<span class="text-blue-400 font-bold">${npc.actionQueue[0].name}</span> 중` : '<span class="text-slate-500">대기 중</span>';
                    let rName = RACES[npc.race] ? RACES[npc.race].name : '알수없음';
                    let nName = npc.name || '무명';
                    return `<div class="bg-slate-800 p-2 mb-2 rounded border border-slate-700 flex justify-between items-center text-xs hover:border-blue-500 cursor-pointer clickable-npc transition-colors shadow-sm" data-npc-id="${npc.id}"><div><div class="font-bold text-white text-sm mb-1">${nName} <span class="text-[10px] text-slate-400 font-normal">(${rName})</span></div><div class="text-slate-400">위치: ${locStr} | 소지: ${npc.gold}G</div></div><div class="text-right bg-slate-900 px-2 py-1 rounded border border-slate-600 max-w-[100px] truncate">${actStr}</div></div>`;
                }).join('');

                if (filteredNPCs.length === 0) npcsHtml = `<div class="text-slate-500 text-sm py-10 text-center">조건에 맞는 NPC가 없습니다.</div>`;

                let raceOpts = `<option value="all">모든 종족</option>` + Object.keys(RACES).map(k => `<option value="${k}" ${debugState.npcRace===k?'selected':''}>${RACES[k].name}</option>`).join('');
                let nationOpts = `<option value="all">모든 국가</option><option value="none" ${debugState.npcNation==='none'?'selected':''}>무소속 야인</option>` + state.history.nations.map(n => `<option value="${n.id}" ${debugState.npcNation===n.id.toString()?'selected':''}>${n.name}</option>`).join('');

                mainHtml = `
                    <div class="flex flex-col h-full min-h-0 animate-fade-in">
                        <div class="flex gap-2 mb-2 shrink-0">
                            <select class="bg-slate-900 text-white border border-slate-600 rounded px-2 py-1 flex-1 text-xs outline-none" onchange="debugState.npcRace=this.value; renderDebugModalContent()">${raceOpts}</select>
                            <select class="bg-slate-900 text-white border border-slate-600 rounded px-2 py-1 flex-1 text-xs outline-none" onchange="debugState.npcNation=this.value; renderDebugModalContent()">${nationOpts}</select>
                        </div>
                        <div class="text-xs text-slate-400 mb-3 shrink-0">검색결과: ${filteredNPCs.length}명</div>
                        <div class="flex-1 overflow-y-auto pr-2 custom-scroll">${npcsHtml}</div>
                    </div>
                `;
            }

            // 전체 레이아웃 렌더링
            content.innerHTML = `
                <div class="flex flex-col w-full h-full min-h-[40vh] max-h-[60vh]">
                    ${tabsHtml}
                    <div class="flex-1 min-h-0 overflow-hidden flex flex-col">
                        ${mainHtml}
                    </div>
                </div>
            `;
        }

        function showNPCDetail(npcId) {
            const npc = state.npcs.find(n => n.id === npcId);
            if (!npc) return;
            const modal = document.getElementById('npc-detail-modal');
            let rName = RACES[npc.race] ? RACES[npc.race].name : '알수없음';
            let gender = npc.gender === 'M' ? '남성' : '여성';

            document.getElementById('npc-detail-title').innerHTML = `${npc.name || '무명'} <span class="text-sm font-normal text-slate-400 ml-2">(${rName} / ${gender} / ${npc.age}세)</span>`;

            let traitsStr = npc.traits.map(tId => TRAITS[tId] ? `${TRAITS[tId].icon} ${TRAITS[tId].name}` : '').filter(Boolean).join(', ') || '없음';
            let statsHtml = `
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div class="bg-slate-800 border border-slate-700 p-2 rounded text-center">💪 근력: <span class="text-red-400 font-bold">${npc.finalStats.str}</span></div>
                    <div class="bg-slate-800 border border-slate-700 p-2 rounded text-center">🔮 마력: <span class="text-blue-400 font-bold">${npc.finalStats.mag}</span></div>
                    <div class="bg-slate-800 border border-slate-700 p-2 rounded text-center">⚡ 민첩: <span class="text-green-400 font-bold">${npc.finalStats.agi}</span></div>
                    <div class="bg-slate-800 border border-slate-700 p-2 rounded text-center">🗣️ 화술: <span class="text-purple-400 font-bold">${npc.finalStats.cha}</span></div>
                </div>
            `;
            let canReadMind = state.player.traits.includes('mind_reader');
            const debugModal = document.getElementById('debug-modal');
            const floatingTool = document.getElementById('floating-debug-tool');
            const isDebugVisible = (debugModal && !debugModal.classList.contains('hidden')) || (floatingTool && !floatingTool.classList.contains('hidden'));

            let hiddenStatsStr = `
                <div class="text-xs bg-slate-800 p-3 rounded border border-slate-700 space-y-1.5 mt-3">
                    <div class="font-bold text-slate-400 border-b border-slate-700 pb-1 mb-2">성향 지표 (0~100)</div>
                    <div class="grid grid-cols-2 gap-1">
                        <div>호전성: <span class="text-white">${npc.hiddenStats.aggression}</span></div>
                        <div>사교성: <span class="text-white">${npc.hiddenStats.sociability}</span></div>
                        <div>야심: <span class="${canReadMind ? 'text-purple-400 font-bold' : 'text-slate-500'}">${canReadMind ? npc.hiddenStats.ambition : '???'}</span></div>
                        <div>도덕성: <span class="text-white">${npc.hiddenStats.morality}</span></div>
                    </div>
                </div>
            `;
            let compatibilityDebugHtml = '';
            if (isDebugVisible) {
                const partner = npc.spouseId ? state.npcs.find(n => n.id === npc.spouseId) || (state.player.id === npc.spouseId ? state.player : null) : null;
                const playerCompatibility = getSexCompatibility(state.player, npc);
                compatibilityDebugHtml = `
                    <div class="text-xs bg-slate-900/70 p-3 rounded border border-rose-900/50 space-y-1.5 mt-3">
                        <div class="font-bold text-rose-300 border-b border-slate-700 pb-1 mb-2">[디버그] 속궁합/임신 지표</div>
                        <div>고유 시드: <span class="text-white font-mono">${npc.seedCode || '미설정'}</span></div>
                        <div>플레이어와 속궁합: <span class="text-rose-300 font-bold">${playerCompatibility}</span></div>
                        <div>배우자: <span class="text-white">${partner ? partner.name : '없음'}</span></div>
                        <div>배우자와 속궁합: <span class="text-rose-300 font-bold">${partner ? getSexCompatibility(npc, partner) : '-'}</span></div>
                        <div>임신 상태: <span class="text-white">${npc.pregnancy ? '임신 중' : '해당 없음'}</span></div>
                    </div>
                `;
            }

            let ambitionHtml = '';
            if (canReadMind) {
                let ambitionObj = AMBITIONS[npc.ambition.type] || AMBITIONS['peaceful'];
                let ambitionDesc = ambitionObj.desc;
                if (npc.ambition.type === 'revenge' && npc.ambition.targetId) {
                    let targetNPC = state.npcs.find(n => n.id === npc.ambition.targetId);
                    let targetName = targetNPC ? targetNPC.name : '알수없는 자';
                    ambitionDesc = ambitionDesc.replace('{target}', targetName);
                }
                ambitionHtml = `
                    <div class="mt-3 bg-slate-800 p-3 rounded border border-purple-900/50 shadow-[0_0_10px_rgba(168,85,247,0.15)]">
                        <div class="font-bold text-purple-400 border-b border-slate-700 pb-1 mb-2 flex items-center">
                            <span class="text-lg mr-2">👁️</span> 숙원 (독심술로 파악함)
                        </div>
                        <div class="text-white font-bold mb-1">${ambitionObj.icon} ${ambitionObj.name}</div>
                        <div class="text-xs text-slate-300 leading-relaxed">${ambitionDesc}</div>
                    </div>
                `;
            } else {
                ambitionHtml = `
                    <div class="mt-3 bg-slate-800 p-3 rounded border border-slate-700">
                        <div class="font-bold text-slate-400 border-b border-slate-700 pb-1 mb-2 flex items-center">
                            <span class="text-lg mr-2">🔒</span> 숙원 (여생의 목표)
                        </div>
                        <div class="text-slate-500 font-bold mb-1">???</div>
                        <div class="text-xs text-slate-600 leading-relaxed">상대방의 깊은 속마음은 알 수 없습니다. 독심술이 필요합니다.</div>
                    </div>
                `;
            }

            let statusStr = npc.actionQueue.length > 0 ? `<span class="text-blue-400 font-bold">${npc.actionQueue[0].name}</span> 중` : '대기 중';

            // 💡 플레이어와의 호감도 계산 로직
            let favorVal = npc.relationships ? npc.relationships[state.player.id] : undefined;
            let favorHtml = "";
            if (favorVal === undefined) {
                favorHtml = `<span class="text-slate-500">일면식 없음</span>`;
            } else {
                let fColor = favorVal > 50 ? "text-pink-400" : (favorVal > 20 ? "text-green-400" : (favorVal < -20 ? "text-rose-400" : "text-slate-300"));
                let fIcon = favorVal > 50 ? "💖" : (favorVal > 20 ? "😊" : (favorVal < -50 ? "🤬" : (favorVal < -20 ? "😠" : "😐")));
                favorHtml = `<span class="${fColor} font-bold">${fIcon} ${favorVal}</span>`;
            }

            document.getElementById('npc-detail-content').innerHTML = `
                <div class="flex items-center gap-4 mb-4 bg-slate-900 p-3 rounded border border-slate-700 shadow-inner">
                    <div class="w-16 h-16 shrink-0 rounded bg-slate-800 border border-slate-600 text-3xl flex items-center justify-center overflow-hidden">
                        ${getPortraitHtml(npc.race, npc.gender, npc.portraitId || 1, RACES[npc.race]?.icon || '🧑', 'w-full h-full')}
                    </div>
                    <div>
                        <div class="font-bold text-white text-lg">${npc.name || '무명'}</div>
                        <div class="text-xs text-slate-400">${RACES[npc.race] ? RACES[npc.race].name : '알수없음'} / ${npc.gender === 'M' ? '남성' : '여성'} / ${npc.age}세</div>
                        <div class="text-xs text-emerald-300 mt-1">건강: ${Math.max(0, npc.health ?? 100)}</div>
                    </div>
                </div>
                <div class="flex justify-between border-b border-slate-700 pb-2 text-sm"><span class="text-slate-400">나에 대한 호감도</span>${favorHtml}</div>
                <div class="flex justify-between border-b border-slate-700 pb-2 text-sm"><span class="text-slate-400">현재 상태</span><span>${statusStr}</span></div>
                <div class="flex justify-between border-b border-slate-700 pb-2 text-sm"><span class="text-slate-400">소지금</span><span class="text-yellow-400 font-bold">${npc.gold} G</span></div>
                <div class="border-b border-slate-700 pb-3 text-sm"><span class="text-slate-400 block mb-1">보유 특성</span><span class="text-white text-xs">${traitsStr}</span></div>
                ${statsHtml}
                ${ambitionHtml}
                ${hiddenStatsStr}
                ${compatibilityDebugHtml}
            `;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        let latestVersionLabelCache = null;
        async function updateTitleVersionLabel() {
            const versionEl = document.getElementById('btn-title-version');
            if (!versionEl) return;

            if (latestVersionLabelCache) {
                versionEl.textContent = latestVersionLabelCache;
                return;
            }

            versionEl.textContent = 'Ver Loading...';
            const res = await fetch('CHANGELOG.md', {
                cache: 'no-store'
            });
            if (!res.ok) {
                versionEl.textContent = 'Ver 정보 확인 실패';
                return;
            }

            const changelog = await res.text();
            const match = changelog.match(/^##\s+(Ver[^\n]+)/m);
            if (!match) {
                versionEl.textContent = 'Ver 정보 없음';
                return;
            }

            latestVersionLabelCache = match[1].trim();
            versionEl.textContent = latestVersionLabelCache;
        }

        // ==========================================
        // 9. 뷰 렌더링 함수들
        // ==========================================
        function renderTitle() {
            appEl.innerHTML = `
                <div class="absolute inset-0 overflow-hidden pointer-events-none"><div class="absolute top-1/4 left-1/4 w-1 h-1 bg-white rounded-full opacity-50 shadow-[0_0_10px_#fff]"></div><div class="absolute top-1/3 right-1/4 w-2 h-2 bg-blue-400 rounded-full opacity-30 shadow-[0_0_15px_#60a5fa]"></div></div>
                <div class="flex-1 flex flex-col justify-center px-12 md:px-32 animate-fade-in z-10"><div class="mb-14"><h2 class="font-fantasy text-blue-400 tracking-[0.3em] text-lg md:text-xl mb-2">CHRONICLES OF AETHERIA</h2><h1 class="text-5xl md:text-7xl font-black text-white tracking-wider text-glow">에테리아 연대기</h1><p class="text-slate-400 mt-6 text-base md:text-lg max-w-lg leading-relaxed">프랙탈 대륙 생성과 유기적인 숲, 그리고 당신의 서사시.</p></div>
                <div class="card-fan-wrap">
                    <div id="title-menu-fan" class="card-fan">
                        <button id="btn-start-flow" class="card-fan-card" data-index="0">
                            <div class="card-fan-card-spin">
                                <div class="card-fan-card-inner">
                                    <div class="card-fan-card-face card-fan-front">
                                        <div class="card-fan-icon" style="color:#38bdf8;">🌍</div>
                                        <div class="card-fan-title">세계 창세</div>
                                        <div class="card-fan-desc">새로운 대륙을 생성하고, 당신만의 역사를 시작합니다.</div>
                                    </div>
                                    <div class="card-fan-card-face card-fan-back">
                                        <div class="card-fan-back-sigil">✶</div>
                                        Aetheria
                                    </div>
                                </div>
                            </div>
                        </button>
                        <button id="btn-load-game-title" class="card-fan-card" data-index="1">
                            <div class="card-fan-card-spin">
                                <div class="card-fan-card-inner">
                                    <div class="card-fan-card-face card-fan-front">
                                        <div class="card-fan-icon" style="color:#34d399;">⏳</div>
                                        <div class="card-fan-title">이어 하기</div>
                                        <div class="card-fan-desc">저장된 세계를 불러와 여정을 계속합니다.</div>
                                    </div>
                                    <div class="card-fan-card-face card-fan-back">
                                        <div class="card-fan-back-sigil">✶</div>
                                        Aetheria
                                    </div>
                                </div>
                            </div>
                        </button>
                        <button id="btn-dictionary" class="card-fan-card" data-index="2">
                            <div class="card-fan-card-spin">
                                <div class="card-fan-card-inner">
                                    <div class="card-fan-card-face card-fan-front">
                                        <div class="card-fan-icon" style="color:#818cf8;">📖</div>
                                        <div class="card-fan-title">백과사전</div>
                                        <div class="card-fan-desc">세계관, 종족, 특성을 확인합니다.</div>
                                    </div>
                                    <div class="card-fan-card-face card-fan-back">
                                        <div class="card-fan-back-sigil">✶</div>
                                        Aetheria
                                    </div>
                                </div>
                            </div>
                        </button>
                        <button id="btn-open-boot" class="card-fan-card" data-index="3">
                            <div class="card-fan-card-spin">
                                <div class="card-fan-card-inner">
                                    <div class="card-fan-card-face card-fan-front">
                                        <div class="card-fan-icon" style="color:#94a3b8;">⚙️</div>
                                        <div class="card-fan-title">설정 및 모드</div>
                                        <div class="card-fan-desc">게임 설정과 모드 로딩을 관리합니다.</div>
                                    </div>
                                    <div class="card-fan-card-face card-fan-back">
                                        <div class="card-fan-back-sigil">✶</div>
                                        Aetheria
                                    </div>
                                </div>
                            </div>
                        </button>
                    </div>
                </div></div>
                <div id="btn-title-version" class="absolute bottom-6 right-6 z-30 pointer-events-auto text-slate-600 text-xs md:text-sm font-fantasy cursor-pointer hover:text-slate-300 transition-colors">Ver Loading...</div>

                <!-- 불러오기 모달 -->
                <div id="load-modal" class="fixed inset-0 bg-black/90 z-[300] hidden items-center justify-center p-4">
                    <div class="bg-slate-900 border border-slate-600 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] p-4 sm:p-6 w-[92vw] sm:w-full max-w-xl sm:max-w-2xl flex flex-col relative text-slate-300 max-h-[80vh]">
                        <button id="btn-close-load" class="absolute top-4 right-4 text-slate-400 hover:text-white text-3xl leading-none">&times;</button>
                        <h3 class="text-2xl font-bold text-white mb-6 border-b border-slate-700 pb-3 flex items-center"><span class="mr-2">💾</span> 게임 불러오기</h3>
                        <div id="load-modal-content" class="flex-1 overflow-y-auto space-y-3 custom-scroll pr-2">
                            <!-- 세이브 슬롯 동적 렌더링 -->
                            <div class="text-center text-slate-500 py-10">세이브 파일을 불러오는 중...</div>
                        </div>
                    </div>
                </div>
            `;
            initCardFan('title-menu-fan', {
                baseZOrder: 'index-desc',
                onCardClick: (card) => handleTitleMenuClick(card.id)
            });
            updateTitleVersionLabel().catch(() => {
                const versionEl = document.getElementById('btn-title-version');
                if (versionEl) versionEl.textContent = 'Ver 정보 확인 실패';
            });
        }

        function handleTitleMenuClick(btnId) {
            if (btnId === 'btn-start-flow') {
                state.screen = 'history';
                render();
                initHistorySimulation();
                stepHistorySimulation();
                return;
            }
            if (btnId === 'btn-load-game-title') {
                openLoadModal();
                return;
            }
            if (btnId === 'btn-dictionary') {
                state.screen = 'dictionary';
                render();
                return;
            }
            if (btnId === 'btn-open-boot') {
                state.screen = 'boot';
                render();
            }
        }

        function initCardFan(containerId, options = {}) {
            const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
            if (!container) return;
            const state = container._cardFanState || { bound: false };
            state.options = options;

            const bindContainerEvents = () => {
                if (state.bound) return;
                state.bound = true;
                container.addEventListener('mouseleave', () => {
                    if (typeof state.resetCards === 'function') state.resetCards();
                });
            };

            const refresh = () => {
                const cards = Array.from(container.querySelectorAll('.card-fan-card'));
                if (!cards.length) return;
                const mid = (cards.length - 1) / 2;
                const cardWidth = cards[0].offsetWidth || 220;
                const requestedSpread = state.options.spread ?? Math.round(cardWidth * 0.65);
                const spreadPadding = state.options.spreadPadding ?? 24;
                const availableWidth = Math.max(cardWidth, (container.clientWidth || 0) - (spreadPadding * 2));
                const maxSpread = mid > 0 ? Math.max(0, (availableWidth - cardWidth) / 2) : 0;
                const spread = mid > 0 ? Math.min(requestedSpread, maxSpread) : 0;
                const arcDrop = state.options.arcDrop ?? 28;
                const arcRotate = state.options.arcRotate ?? 10;
                const focusLift = state.options.focusLift ?? 26;
                const focusScale = state.options.focusScale ?? 1.06;
                const pushBase = state.options.pushBase ?? 26;
                const pushStep = state.options.pushStep ?? 8;
                const pushDrop = state.options.pushDrop ?? 8;
                const pushRotate = state.options.pushRotate ?? 4;
                const clickSpinMs = state.options.clickSpinMs ?? 560;
                const onCardClick = state.options.onCardClick;
                const baseZMode = state.options.baseZOrder || 'index-desc';
                const baseZFn = state.options.baseZIndex;

                const getBaseZ = (index) => {
                    if (typeof baseZFn === 'function') return baseZFn(index, cards.length, mid);
                    if (baseZMode === 'index-desc') return 30 + (cards.length - 1 - index);
                    if (baseZMode === 'index-asc') return 30 + index;
                    return 30 - Math.abs(index - mid);
                };
                const baseZMax = Math.max(...cards.map((_, index) => getBaseZ(index)));

                const setBaseTransform = (card, x, y, rot, scale = 1) => {
                    const transform = `translate(-50%, -50%) translateX(${x}px) translateY(${y}px) rotate(${rot}deg) scale(${scale})`;
                    card.style.setProperty('--base-transform', transform);
                    card.style.transform = transform;
                };

                const applyBase = () => {
                    cards.forEach((card, index) => {
                        const t = mid === 0 ? 0 : (index - mid) / mid;
                        const x = t * spread;
                        const y = Math.abs(t) * arcDrop;
                        const rot = t * arcRotate;
                        card.dataset.baseX = `${x}`;
                        card.dataset.baseY = `${y}`;
                        card.dataset.baseRot = `${rot}`;
                        setBaseTransform(card, x, y, rot, 1);
                        card.style.zIndex = `${getBaseZ(index)}`;
                    });
                };

                const focusCard = (focusIndex) => {
                    cards.forEach((card, index) => {
                        const baseX = parseFloat(card.dataset.baseX || '0');
                        const baseY = parseFloat(card.dataset.baseY || '0');
                        const baseRot = parseFloat(card.dataset.baseRot || '0');
                        const dist = index - focusIndex;
                        if (dist === 0) {
                            setBaseTransform(card, baseX, baseY - focusLift, 0, focusScale);
                            card.style.zIndex = `${baseZMax + 10}`;
                        } else {
                            const push = Math.sign(dist) * (pushBase + Math.abs(dist) * pushStep);
                            const y = baseY + Math.abs(dist) * pushDrop;
                            const rot = baseRot + Math.sign(dist) * pushRotate;
                            setBaseTransform(card, baseX + push, y, rot, 0.98);
                            card.style.zIndex = `${getBaseZ(index)}`;
                        }
                    });
                };

                const resetCards = () => {
                    cards.forEach((card, index) => {
                        const baseX = parseFloat(card.dataset.baseX || '0');
                        const baseY = parseFloat(card.dataset.baseY || '0');
                        const baseRot = parseFloat(card.dataset.baseRot || '0');
                        setBaseTransform(card, baseX, baseY, baseRot, 1);
                        card.style.zIndex = `${getBaseZ(index)}`;
                    });
                };

                const setActiveCard = (activeCard) => {
                    cards.forEach((c) => {
                        if (c === activeCard) return;
                        c.classList.remove('is-active');
                        if (c.dataset.prevZ) {
                            c.style.zIndex = c.dataset.prevZ;
                            c.dataset.prevZ = '';
                        }
                    });
                    if (!activeCard.classList.contains('is-active')) {
                        activeCard.classList.add('is-active');
                    }
                    if (!activeCard.dataset.prevZ) {
                        const idx = cards.indexOf(activeCard);
                        const baseZ = idx >= 0 ? `${getBaseZ(idx)}` : (activeCard.style.zIndex || '');
                        activeCard.dataset.prevZ = baseZ;
                    }
                    activeCard.style.zIndex = `${baseZMax + 50}`;
                };

                const spinAndSelect = (card, done) => {
                    if (card.dataset.spinning === 'true') return;
                    setActiveCard(card);
                    card.dataset.spinning = 'true';
                    const baseTransform = card.style.getPropertyValue('--base-transform') || card.style.transform || 'translate(-50%, -50%)';
                    card.style.setProperty('--spin-base', baseTransform.trim());
                    card.classList.add('is-spinning');
                    setTimeout(() => {
                        card.classList.remove('is-spinning');
                        card.dataset.spinning = 'false';
                        if (typeof onCardClick === 'function') onCardClick(card);
                        card.classList.remove('is-active');
                        if (card.dataset.prevZ) {
                            card.style.zIndex = card.dataset.prevZ;
                            card.dataset.prevZ = '';
                        }
                        if (typeof done === 'function') done();
                    }, clickSpinMs);
                };

                const isHoveringAny = () => cards.some(card => card.matches(':hover'));
                const isFanLocked = () => (
                    container.dataset.shuffling === 'true' ||
                    container.dataset.cardFanLocked === 'true' ||
                    container.dataset.cardFanDragging === 'true'
                );
                const dragThreshold = state.options.dragThreshold ?? 6;
                const dragReturnMs = state.options.dragReturnMs ?? 260;
                const dragReturnEasing = state.options.dragReturnEasing ?? 'cubic-bezier(0.2, 0.8, 0.2, 1)';

                const bindDrag = (card) => {
                    if (card.dataset.dragBound === 'true') return;
                    card.dataset.dragBound = 'true';
                    card.style.touchAction = 'none';

                    const startDrag = (e) => {
                        if (e.button !== undefined && e.button !== 0) return;
                        if (isFanLocked()) return;
                        if (card.dataset.spinning === 'true') return;
                        if (!card.isConnected) return;

                        card.setPointerCapture?.(e.pointerId);
                        card.dataset.dragging = 'pending';
                        card.dataset.dragStartX = `${e.clientX}`;
                        card.dataset.dragStartY = `${e.clientY}`;
                        const baseTransform = card.style.getPropertyValue('--base-transform') || card.style.transform || 'translate(-50%, -50%)';
                        card.dataset.dragBaseTransform = baseTransform;
                        card.dataset.dragBaseZ = card.style.zIndex || '';
                    };

                    const moveDrag = (e) => {
                        if (!card.dataset.dragging) return;
                        const startX = parseFloat(card.dataset.dragStartX || '0');
                        const startY = parseFloat(card.dataset.dragStartY || '0');
                        const dx = e.clientX - startX;
                        const dy = e.clientY - startY;
                        const dist = Math.hypot(dx, dy);

                        if (card.dataset.dragging === 'pending') {
                            if (dist < dragThreshold) return;
                            card.dataset.dragging = 'true';
                            container.dataset.cardFanDragging = 'true';
                        }
                        if (card.dataset.dragging !== 'true') return;

                        const baseTransform = card.dataset.dragBaseTransform || card.style.transform || 'translate(-50%, -50%)';
                        card.style.transition = 'none';
                        card.style.transform = `${baseTransform} translate(${dx}px, ${dy}px)`;
                        card.style.zIndex = `${baseZMax + 20}`;
                    };

                    const endDrag = () => {
                        if (!card.dataset.dragging) return;
                        const wasDragging = card.dataset.dragging === 'true';
                        card.dataset.dragging = '';

                        if (wasDragging) {
                            const baseTransform = card.dataset.dragBaseTransform || card.style.getPropertyValue('--base-transform') || card.style.transform || 'translate(-50%, -50%)';
                            card.style.transition = `transform ${dragReturnMs}ms ${dragReturnEasing}`;
                            card.style.transform = baseTransform;
                            const baseZ = card.dataset.dragBaseZ ?? '';
                            if (baseZ !== '') {
                                card.style.zIndex = baseZ;
                            } else {
                                card.style.zIndex = `${getBaseZ(Array.from(cards).indexOf(card))}`;
                            }
                            container.dataset.cardFanDragging = 'false';
                            card.dataset.dragJustEnded = 'true';
                            setTimeout(() => {
                                card.style.transition = '';
                                card.dataset.dragJustEnded = '';
                            }, dragReturnMs + 20);
                        }
                    };

                    card.addEventListener('pointerdown', startDrag);
                    card.addEventListener('pointermove', moveDrag);
                    card.addEventListener('pointerup', endDrag);
                    card.addEventListener('pointercancel', endDrag);
                    card.addEventListener('lostpointercapture', endDrag);
                };

                applyBase();
                cards.forEach((card, index) => {
                    card.addEventListener('mouseenter', () => {
                        if (isFanLocked()) return;
                        focusCard(index);
                    });
                    card.addEventListener('mouseleave', () => {
                        if (isFanLocked()) return;
                        setTimeout(() => {
                            if (!isHoveringAny()) resetCards();
                        }, 0);
                    });
                    card.addEventListener('click', (e) => {
                        if (typeof onCardClick === 'function') {
                            e.preventDefault();
                            e.stopPropagation();
                            if (card.dataset.dragJustEnded === 'true') return;
                            if (card.dataset.dragging) return;
                            if (isFanLocked()) return;
                            container.dataset.cardFanLocked = 'true';
                            spinAndSelect(card, () => {
                                container.dataset.cardFanLocked = 'false';
                            });
                        }
                    });
                    bindDrag(card);
                });

                state.resetCards = resetCards;
            };

            bindContainerEvents();
            refresh();
            state.refresh = refresh;
            container._cardFanState = state;
        }

        async function openLoadModal() {
            const modal = document.getElementById('load-modal');
            const content = document.getElementById('load-modal-content');
            modal.classList.remove('hidden');
            modal.classList.add('flex');

            try {
                const saveList = await AetheriaSaveManager.getSaveList();
                let html = '';

                const renderSlot = (id, label) => {
                    const save = saveList.find(s => s.slotId === id);
                    if (save) {
                        const date = new Date(save.timestamp).toLocaleString('ko-KR');
                        return `
                            <div class="save-slot bg-slate-800 border border-slate-600 p-4 rounded-lg flex justify-between items-center cursor-pointer" data-action="load-slot" data-slot="${id}">
                                <div>
                                    <div class="font-bold text-white mb-1"><span class="text-blue-400 mr-2">[${label}]</span> ${save.summary}</div>
                                    <div class="text-xs text-slate-400">진행도: ${save.dateInfo} | 소지금: ${save.gold} G</div>
                                    <div class="text-[10px] text-slate-500 mt-1">저장 일시: ${date}</div>
                                </div>
                                <button class="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded text-sm font-bold shadow-md">불러오기</button>
                            </div>
                        `;
                    } else {
                        return `
                            <div class="bg-slate-900 border border-dashed border-slate-700 p-4 rounded-lg flex justify-center items-center opacity-60">
                                <span class="text-slate-500 font-bold">[${label}] 빈 슬롯</span>
                            </div>
                        `;
                    }
                };

                html += renderSlot('auto', '자동 저장');
                html += renderSlot('slot1', '슬롯 1');
                html += renderSlot('slot2', '슬롯 2');
                html += renderSlot('slot3', '슬롯 3');

                // 브라우저 샌드박스 등에서 초기화될 것을 대비한 로컬 파일 불러오기 기능 추가
                html += `
                    <div class="mt-6 pt-4 border-t border-slate-700">
                        <h4 class="text-white font-bold mb-3 flex items-center"><span class="text-emerald-400 text-lg mr-2">📂</span> PC 파일에서 세이브 복구</h4>
                        <p class="text-xs text-slate-400 mb-3">다운로드 해두었던 .json 세이브 파일을 선택해 이어서 플레이할 수 있습니다.</p>
                        <div class="relative bg-slate-800 border-2 border-dashed border-slate-500 hover:border-emerald-400 rounded-lg p-4 text-center cursor-pointer transition-colors group">
                            <input type="file" id="input-save-file" accept=".json" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                            <span class="text-slate-300 group-hover:text-emerald-300 font-bold text-sm">클릭하여 세이브 파일 선택 (.json)</span>
                        </div>
                    </div>
                `;

                content.innerHTML = html;
            } catch (err) {
                content.innerHTML = `<div class="text-rose-500 text-center py-10">세이브 파일을 불러오는 중 오류가 발생했습니다.<br>${err}</div>`;
            }
        }

        function renderDictionary() {
            const tierOrder = ['유일', '전설', '영웅', '희귀', '일반'];
            let contentHtml = '';
            tierOrder.forEach(tier => {
                const traitsInTier = Object.values(TRAITS).filter(t => t.tier === tier && (!t.reqAdult || state.adultMode));
                if (traitsInTier.length === 0) return;
                const traitsHtml = traitsInTier.map(trait => {
                    const styles = getTierStyles(trait.tier, true);
                    const genderReq = trait.reqGender ? `<span class="text-[10px] ml-2 px-1 rounded bg-slate-800 border border-slate-600 text-slate-400">${trait.reqGender === 'M' ? '남성 전용' : '여성 전용'}</span>` : '';
                    const adultReq = trait.reqAdult ? `<span class="text-[10px] ml-2 px-1 rounded bg-rose-950 border border-rose-600 text-rose-300">성인 전용</span>` : '';
                    const acqTag = `<span class="text-[10px] ml-2 px-1 rounded bg-slate-800 text-slate-400">${trait.acq==='innate'?'선천적':'후천적'}</span>`;
                    const catTag = `<span class="text-[10px] ml-1 px-1 rounded bg-slate-800 text-slate-400">${trait.cat==='physical'?'육체':trait.cat==='mental'?'정신':'기타'}</span>`;
                    return `<div class="p-4 rounded-lg flex flex-col items-start relative border-l-4 border-r border-t border-b ${styles.cardClass} ${trait.reqAdult ? 'border-rose-800 bg-rose-950/20' : ''}"><div class="font-bold text-lg mb-2 flex flex-wrap items-center w-full"><span class="mr-2 text-2xl">${trait.icon}</span> <span class="${trait.reqAdult ? 'text-rose-400' : ''}">${trait.name}</span> ${acqTag}${catTag}${genderReq}${adultReq}</div><div class="text-sm text-slate-300 mb-3 leading-relaxed">${trait.desc}</div>${formatBonusText(trait.bonus)}</div>`;
                }).join('');
                let titleColor = "text-slate-300 border-slate-600";
                if (tier === '유일') titleColor = "text-rose-400 border-rose-900";
                else if (tier === '전설') titleColor = "text-orange-400 border-orange-900";
                else if (tier === '영웅') titleColor = "text-purple-400 border-purple-900";
                else if (tier === '희귀') titleColor = "text-blue-400 border-blue-900";
                contentHtml += `<div class="mb-10"><h3 class="text-xl font-bold mb-4 border-b pb-2 flex items-center ${titleColor}"><span class="mr-2 px-2 py-0.5 text-sm rounded ${getTierStyles(tier).badgeClass}">${tier}</span>등급 특성 목록</h3><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${traitsHtml}</div></div>`;
            });
            appEl.innerHTML = `<div class="min-h-screen p-4 md:p-8 flex flex-col items-center bg-slate-900/90 animate-fade-in relative"><div class="w-full max-w-6xl w-full flex justify-start mb-6 shrink-0"><button id="btn-back-title" class="text-slate-400 hover:text-white flex items-center transition-colors font-bold text-lg"><svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg> 타이틀로 돌아가기</button></div><div class="w-full max-w-6xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col h-[80vh]"><div class="p-6 border-b border-slate-700 bg-slate-800/50 shrink-0"><h2 class="text-3xl font-black text-white text-center tracking-widest font-fantasy">에테리아 백과사전 (ENCYCLOPEDIA)</h2></div><div class="p-6 md:p-8 overflow-y-auto flex-1">${contentHtml}</div></div></div>`;
        }

        function renderHistoryLayout() {
            appEl.innerHTML = `<div class="min-h-screen flex flex-col bg-slate-900 animate-fade-in h-screen overflow-hidden"><div class="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center shadow-md z-20 shrink-0"><div><h2 class="text-xl font-bold text-white tracking-widest font-fantasy">역사 시뮬레이션</h2><p class="text-xs text-slate-400 mt-1">10년 단위로 진행되며, 필요할 때 일시정지 상태에서 월드 이벤트를 선택할 수 있습니다.</p></div><div class="flex items-center space-x-2 md:space-x-4"><div class="text-blue-400 font-bold" id="ui-history-progress">진행 중: 0년</div><button id="btn-history-pause" class="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-sm rounded transition-colors">일시정지</button><button id="btn-history-event" class="px-4 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-sm rounded transition-colors">월드 이벤트</button><button id="btn-history-log" class="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors">로그 보기</button><button id="btn-history-end" class="px-4 py-1.5 bg-rose-700 hover:bg-rose-600 text-white text-sm rounded transition-colors">시뮬 종료</button><button id="btn-enter-origin" class="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow-[0_0_10px_rgba(37,99,235,0.5)] transition-all hidden">태생 선택</button></div></div><div class="flex flex-1 overflow-hidden"><div id="map-wrapper" class="w-full relative overflow-auto bg-black map-container"><div class="relative inline-block leading-none"><canvas id="world-canvas" class="block"></canvas><canvas id="player-canvas" class="absolute top-0 left-0 pointer-events-none"></canvas></div><div id="history-world-event-overlay" class="fixed inset-0 w-screen bg-black/70 backdrop-blur-sm hidden items-center justify-center z-20 p-4 md:p-6"></div></div></div><div id="history-log-modal" class="fixed inset-0 bg-black/80 z-[250] hidden items-center justify-center p-4"><div class="w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-600 rounded-2xl shadow-2xl flex flex-col"><div class="p-4 border-b border-slate-700 flex items-center justify-between"><h3 class="text-2xl font-black text-white font-fantasy">연대기 로그</h3><button id="btn-close-history-log" class="text-slate-300 hover:text-white text-xl">&times;</button></div><div id="history-log-modal-content" class="flex-1 overflow-y-auto p-4 space-y-2 custom-scroll"></div></div></div></div>`;
            renderHistoryUI();
        }

        function renderHistoryLogModalContent() {
            const content = document.getElementById('history-log-modal-content');
            if (!content) return;
            if (!state.history.logs || state.history.logs.length === 0) {
                content.innerHTML = `<div class="text-slate-500 text-sm text-center py-10 border border-dashed border-slate-700 rounded">기록된 로그가 없습니다.</div>`;
                return;
            }
            content.innerHTML = state.history.logs.map(log => `<div class="bg-slate-800/70 p-3 rounded border-l-4 border-blue-500 text-sm text-slate-200">${log}</div>`).join('');
        }

        function openHistoryLogModal() {
            const modal = document.getElementById('history-log-modal');
            if (!modal) return;
            renderHistoryLogModalContent();
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeHistoryLogModal() {
            const modal = document.getElementById('history-log-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        function renderHistoryWorldEventOverlay() {
            const overlay = document.getElementById('history-world-event-overlay');
            if (!overlay) return;
            const choices = state.history.pendingWorldEventChoices || [];
            if (!state.history.isPausedForEvent || choices.length === 0 || state.history.isFinished) {
                overlay.classList.add('hidden');
                overlay.classList.remove('flex');
                overlay.dataset.resolving = 'false';
                overlay.innerHTML = '';
                return;
            }
            const colorClassMap = {
                rose: 'border-rose-500',
                amber: 'border-amber-500',
                emerald: 'border-emerald-500',
                indigo: 'border-indigo-500',
                violet: 'border-violet-500'
            };
            const cardsHtml = choices.map((choice, index) => {
                const borderClass = colorClassMap[choice.color] || 'border-slate-600';
                return `<button class="card-fan-card ${borderClass}" data-history-event-index="${index}"><div class="card-fan-card-spin"><div class="card-fan-card-inner"><div class="card-fan-card-face card-fan-front"><div class="card-fan-icon">${choice.icon}</div><div class="card-fan-title">${choice.title}</div><div class="card-fan-desc">${choice.desc}</div></div><div class="card-fan-card-face card-fan-back"><div class="card-fan-back-sigil">✦</div>FATE</div></div></div></button>`;
            }).join('');
            overlay.innerHTML = `<div class="w-full max-w-none mx-auto"><div class="text-center mb-8"><h3 class="text-3xl font-black text-white tracking-wider font-fantasy">월드 이벤트 선택</h3><p class="text-slate-300 mt-2">정지된 시간 속에서, 다음 시대를 이끌 운명을 고르세요.</p></div><div class="card-fan-wrap center w-full"><div id="history-world-event-fan" class="card-fan">${cardsHtml}</div></div></div>`;
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
            initCardFan('history-world-event-fan', {
                spread: 170,
                arcDrop: 24,
                arcRotate: 8,
                onCardClick: (card) => {
                    if (overlay.dataset.resolving === 'true') return;
                    const idx = Number(card.dataset.historyEventIndex);
                    const choice = choices[idx];
                    if (!choice) return;
                    overlay.dataset.resolving = 'true';
                    chooseHistoryWorldEvent(choice.id);
                }
            });
            runCardFanShuffle('history-world-event-fan', {
                withFlip: true,
                flipStagger: 100,
                gatherDuration: 420,
                rotateDuration: 420
            });
        }

        function renderHistoryUI() {
            const progEl = document.getElementById('ui-history-progress');
            if (progEl) progEl.innerText = `진행 중: ${state.history.currentTurn}년`;
            const pauseBtn = document.getElementById('btn-history-pause');
            if (pauseBtn) {
                pauseBtn.innerText = state.history.isPaused ? '재개' : '일시정지';
                pauseBtn.classList.toggle('bg-emerald-700', state.history.isPaused);
                pauseBtn.classList.toggle('hover:bg-emerald-600', state.history.isPaused);
                pauseBtn.classList.toggle('bg-amber-700', !state.history.isPaused);
                pauseBtn.classList.toggle('hover:bg-amber-600', !state.history.isPaused);
            }
            state.mapLayers.borders = true;
            state.mapLayers.influence = true;
            drawCanvasMap(false);
            renderHistoryWorldEventOverlay();
            renderHistoryLogModalContent();
        }

        function renderOriginLayout() {
            const cardsHtml = state.origins.map((origin, index) => {
                let icon = origin.type === 'isekai' ? '✨' : origin.type === 'regression' ? '⏳' : origin.type === 'possession' ? '👻' : origin.type === 'npc_child' ? '👨‍👩‍👧' : '🍃';
                const isSpecial = ['isekai', 'regression', 'possession'].includes(origin.type);
                let specialBorder = isSpecial ? 'border-purple-500 is-special' : 'border-slate-600';
                return `<button class="card-fan-card ${specialBorder}" data-origin-index="${index}"><div class="card-fan-card-spin"><div class="card-fan-card-inner"><div class="card-fan-card-face card-fan-front"><div class="card-fan-icon">${icon}</div><div class="card-fan-title">${origin.title}</div><div class="card-fan-desc">${origin.desc}</div></div><div class="card-fan-card-face card-fan-back"><div class="card-fan-back-sigil">✦</div>Destiny</div></div></div></button>`;
            }).join('');
            appEl.innerHTML = `<div class="min-h-screen p-8 flex flex-col items-center justify-center bg-slate-900 animate-fade-in relative"><div class="text-center mb-8"><h2 class="text-4xl font-black text-white tracking-wider mb-2 font-fantasy">운명의 시작</h2><p class="text-slate-400">당신은 어떤 존재로 이 세계에 강림하시겠습니까?</p></div><div class="card-fan-wrap center mb-6"><div id="origin-card-fan" class="card-fan">${cardsHtml}</div></div><button id="btn-reroll-origin" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.4)] flex items-center transition-all"><span class="mr-2">🎲</span> 운명 다시 굴리기</button></div>`;
            initCardFan('origin-card-fan', {
                spread: 170,
                arcDrop: 24,
                arcRotate: 8,
                onCardClick: (card) => handleOriginSelection(card.dataset.originIndex)
            });
        }

        function updateOriginCards(options = {}) {
            const container = document.getElementById('origin-card-fan');
            if (!container) return;
            const cardsHtml = state.origins.map((origin, index) => {
                let icon = origin.type === 'isekai' ? '✨' : origin.type === 'regression' ? '⏳' : origin.type === 'possession' ? '👻' : origin.type === 'npc_child' ? '👨‍👩‍👧' : '🍃';
                const isSpecial = ['isekai', 'regression', 'possession'].includes(origin.type);
                let specialBorder = isSpecial ? 'border-purple-500 is-special' : 'border-slate-600';
                return `<button class="card-fan-card ${specialBorder}" data-origin-index="${index}"><div class="card-fan-card-spin"><div class="card-fan-card-inner"><div class="card-fan-card-face card-fan-front"><div class="card-fan-icon">${icon}</div><div class="card-fan-title">${origin.title}</div><div class="card-fan-desc">${origin.desc}</div></div><div class="card-fan-card-face card-fan-back"><div class="card-fan-back-sigil">✦</div>Destiny</div></div></div></button>`;
            }).join('');
            container.classList.remove('is-gathering', 'is-spreading');
            container.innerHTML = cardsHtml;
            initCardFan(container, {
                spread: 170,
                arcDrop: 24,
                arcRotate: 8,
                onCardClick: (card) => handleOriginSelection(card.dataset.originIndex)
            });
            if (options.animate === false) return;
            const cards = Array.from(container.querySelectorAll('.card-fan-card'));
            const maxDelay = applyCardFanShuffleVars(cards);
            const spreadDuration = 980;
            const spreadDone = spreadDuration + maxDelay + 80;
            container.classList.add('is-spreading');
            setTimeout(() => {
                container.classList.remove('is-spreading');
                container.dataset.shuffling = 'false';
                if (container._cardFanState && typeof container._cardFanState.resetCards === 'function') {
                    container._cardFanState.resetCards();
                }
            }, spreadDone);
        }

        function applyCardFanShuffleVars(cards) {
            let maxDelay = 0;
            cards.forEach((card, index) => {
                const baseX = parseFloat(card.dataset.baseX || '0');
                const baseY = parseFloat(card.dataset.baseY || '0');
                const baseRot = parseFloat(card.dataset.baseRot || '0');
                // 덱이 하나처럼 모이도록 흔들림을 최소화합니다.
                const stackX = (-baseX) + (Math.random() * 6 - 3);
                const stackY = (-baseY) + (Math.random() * 6 - 3);
                const stackRot = (-baseRot) + (Math.random() * 3 - 1.5);
                const releaseX = (Math.random() * 10 - 5);
                const releaseY = (Math.random() * 10 - 5);
                const delay = 30 + Math.random() * 110;
                maxDelay = Math.max(maxDelay, delay);
                // 덱의 맨 위(왼쪽 카드)부터 번갈아가며 시계/반시계 방향을 부여합니다.
                const stackRank = index;
                const dir = (stackRank % 2 === 0) ? 1 : -1;
                const baseTurns = Math.random() > 0.5 ? 2 : 3;
                const turns = baseTurns * 1.5;
                const perTurnMs = turns <= 3 ? 180 : 120;
                card.style.setProperty('--stack-x', `${stackX.toFixed(1)}px`);
                card.style.setProperty('--stack-y', `${stackY.toFixed(1)}px`);
                card.style.setProperty('--stack-rot', `${stackRot.toFixed(1)}deg`);
                card.style.setProperty('--stack-scale', `${(0.94 + Math.random() * 0.015).toFixed(2)}`);
                card.style.setProperty('--release-x', `${releaseX.toFixed(1)}px`);
                card.style.setProperty('--release-y', `${releaseY.toFixed(1)}px`);
                card.style.setProperty('--shuffle-delay', `${Math.round(delay)}ms`);
                card.style.setProperty('--shuffle-dir', `${dir}`);
                card.style.setProperty('--shuffle-turns', `${turns}`);
                card.style.setProperty('--shuffle-turn-ms', `${perTurnMs}ms`);
                card.style.zIndex = `${50 + (cards.length - 1 - stackRank)}`;
            });
            return Math.round(maxDelay);
        }

        function applyOriginCardData(cards) {
            cards.forEach((card, index) => {
                const origin = state.origins[index];
                if (!origin) return;
                const icon = origin.type === 'isekai' ? '✨' : origin.type === 'regression' ? '⏳' : origin.type === 'possession' ? '👻' : origin.type === 'npc_child' ? '👨‍👩‍👧' : '🍃';
                const isSpecial = ['isekai', 'regression', 'possession'].includes(origin.type);
                const iconEl = card.querySelector('.card-fan-icon');
                const titleEl = card.querySelector('.card-fan-title');
                const descEl = card.querySelector('.card-fan-desc');
                if (iconEl) iconEl.textContent = icon;
                if (titleEl) titleEl.textContent = origin.title;
                if (descEl) descEl.textContent = origin.desc;
                card.dataset.originIndex = `${index}`;
                card.classList.remove('border-purple-500', 'border-slate-600', 'is-special');
                card.classList.add(isSpecial ? 'border-purple-500' : 'border-slate-600');
                if (isSpecial) card.classList.add('is-special');
            });
        }

        function runCardFanShuffle(container, options = {}) {
            const fan = typeof container === 'string' ? document.getElementById(container) : container;
            if (!fan) return;
            if (fan.dataset.shuffling === 'true') return;
            const cards = Array.from(fan.querySelectorAll('.card-fan-card'));
            if (!cards.length) return;

            fan.dataset.shuffling = 'true';

            const gatherDuration = options.gatherDuration ?? 520;
            const flipDuration = options.flipDuration ?? 360;
            const rotateDuration = options.rotateDuration ?? 540;
            const spreadDuration = options.spreadDuration ?? 980;
            const flipStagger = options.flipStagger ?? 120;
            const withFlip = options.withFlip !== false;
            const onFlipped = options.onFlipped;
            const onDone = options.onDone;

            const maxDelay = applyCardFanShuffleVars(cards);
            const gatherDone = gatherDuration + maxDelay + 40;
            const spreadDone = spreadDuration + maxDelay + 40;

            fan.classList.remove('is-spreading', 'is-rotating');
            fan.classList.add('is-gathering');
            setTimeout(() => {
                if (withFlip) {
                    fan.classList.add('is-deck-flip');
                    cards.forEach(card => card.classList.add('is-flipped'));
                }
                const afterFlip = () => {
                    if (typeof onFlipped === 'function') onFlipped(cards);
                    fan.classList.add('is-rotating');
                    setTimeout(() => {
                        fan.classList.remove('is-rotating');
                        fan.classList.remove('is-gathering');
                        fan.classList.add('is-spreading');
                        setTimeout(() => {
                            fan.classList.remove('is-spreading');
                            if (withFlip) {
                                fan.classList.remove('is-deck-flip');
                                cards.forEach((card, index) => {
                                    setTimeout(() => card.classList.remove('is-flipped'), index * flipStagger);
                                });
                            }
                            const flipDone = withFlip ? (cards.length * flipStagger + flipDuration + 120) : 0;
                            setTimeout(() => {
                                if (fan._cardFanState && typeof fan._cardFanState.resetCards === 'function') {
                                    fan._cardFanState.resetCards();
                                }
                                fan.dataset.shuffling = 'false';
                                if (typeof onDone === 'function') onDone();
                            }, flipDone);
                        }, spreadDone);
                    }, rotateDuration);
                };

                if (withFlip) {
                    setTimeout(afterFlip, flipDuration + 40);
                } else {
                    afterFlip();
                }
            }, gatherDone);
        }

        function rerollOriginCards() {
            const container = document.getElementById('origin-card-fan');
            if (!container) {
                generateOrigins();
                render();
                return;
            }
            const cards = Array.from(container.querySelectorAll('.card-fan-card'));
            if (!cards.length) {
                generateOrigins();
                updateOriginCards({ animate: true });
                return;
            }

            runCardFanShuffle(container, {
                withFlip: true,
                onFlipped: (fanCards) => {
                    generateOrigins();
                    applyOriginCardData(fanCards);
                }
            });
        }

        function handleOriginSelection(originIndex) {
            const idx = Number(originIndex);
            const chosenOrigin = state.origins[idx];
            if (!chosenOrigin) return;
            state.player = {
                id: 'player_0',
                name: '',
                gender: 'M',
                age: '',
                height: '',
                weight: '',
                race: 'human',
                seedCode: generateEntitySeedCode(),
                health: 100,
                isDead: false,
                originType: chosenOrigin.type,
                parents: chosenOrigin.parents || null,
                baseStats: {
                    str: 50,
                    mag: 50,
                    agi: 50,
                    cha: 60
                },
                traits: [],
                addedStats: {
                    str: 0,
                    mag: 0,
                    agi: 0,
                    cha: 0
                },
                finalStats: {
                    str: 0,
                    mag: 0,
                    agi: 0,
                    cha: 0
                },
                hiddenStats: {
                    pLength: 0,
                    vDepth: 0,
                    bust: 0,
                    waist: 0,
                    hip: 0,
                    aggression: 0,
                    sociability: 0,
                    ambition: 0,
                    morality: 0,
                    lust: 0,
                    prefGender: '이성',
                    prefAge: '상관없음'
                },
                gold: 0,
                status: '재야',
                location: null,
                actionQueue: [],
                apPool: 0,
                titles: ['이방인'],
                equipment: {
                    head: null,
                    face: null,
                    left_hand: null,
                    right_hand: null,
                    acc1: null,
                    acc2: null,
                    acc3: null,
                    top: null,
                    waist: null,
                    bottom: null,
                    left_thigh: null,
                    right_thigh: null,
                    feet: null,
                    tail: null,
                    back: 'leather_bag',
                    vagina: null,
                    anus: null,
                    womb: null,
                    penis: null
                },
                baseInventory: {
                    w: 10,
                    h: 5,
                    items: [{
                        id: 'sword_basic',
                        x: 0,
                        y: 0,
                        durability: 100
                    }, {
                        id: 'potion_hp',
                        x: 1,
                        y: 0,
                        durability: 1
                    }]
                },
                bagInventory: {
                    w: 4,
                    h: 4,
                    items: [{
                        id: 'adult_toy',
                        x: 0,
                        y: 0,
                        durability: 30
                    }]
                },
                leftThighInventory: {
                    w: 2,
                    h: 3,
                    items: []
                },
                rightThighInventory: {
                    w: 2,
                    h: 3,
                    items: []
                },
                mercenaries: [],
                relationships: {},
                spouseId: null,
                pregnancy: null,
                lastSexTurn: null,
                fiefdoms: [],
                creations: [],
                rp: 0,
                pp: 0,
                ip: 0,
                regressionYear: 52,
                portraitId: Math.floor(Math.random() * 2) + 1 // 💡 플레이어에게도 랜덤 초상화 ID 부여
            };
            if (chosenOrigin.type === 'npc_child') {
                state.player.race = chosenOrigin.parents.mother.race;
                state.player.baseStats = {
                    str: Math.floor((chosenOrigin.parents.mother.baseStats.str + chosenOrigin.parents.father.baseStats.str) / 2),
                    mag: Math.floor((chosenOrigin.parents.mother.baseStats.mag + chosenOrigin.parents.father.baseStats.mag) / 2),
                    agi: Math.floor((chosenOrigin.parents.mother.baseStats.agi + chosenOrigin.parents.father.baseStats.agi) / 2),
                    cha: Math.floor((chosenOrigin.parents.mother.baseStats.cha + chosenOrigin.parents.father.baseStats.cha) / 2)
                };
            } else {
                state.player.baseStats = {
                    ...RACES[state.player.race].baseStats
                };
            }
            const pStats = generatePhysicalAndHiddenStats(state.player.race, state.player.gender);
            state.player.age = pStats.age;
            state.player.height = pStats.height;
            state.player.weight = pStats.weight;
            state.player.hiddenStats = pStats.hidden;
            // 기존 코드 마지막 부분 수정
            state.screen = 'create';
            render();
            rollTraits();

            // 💡 추가: 생성창 진입 시 현재 종족/성별의 초상화 30장을 백그라운드에서 미리 로드
            ImagePreloader.preloadCurrentSet(state.player.race, state.player.gender);

            updateCharacterUI();
        }

        function renderCharacterCreationLayout() {
            const isChild = state.player.originType === 'npc_child';
            const isPossession = state.player.originType === 'possession';
            const isReincarnationParentSelected = state.player.originType === 'isekai' && document.getElementById('sel-reincarnation-parent')?.value;
            const totalBP = state.player.originType === 'isekai' ? REINCARNATION_BONUS_POINTS : DEFAULT_BONUS_POINTS;
            const raceButtonsHtml = Object.values(RACES).map(race => `<div id="race-card-${race.id}" class="select-card p-2 md:p-3 rounded-lg flex flex-col items-center justify-center text-center ${((isChild || isPossession || isReincarnationParentSelected) && state.player.race !== race.id) ? 'locked' : ''}" data-type="race" data-id="${race.id}"><div class="text-2xl md:text-3xl mb-1">${race.icon}</div><div class="font-bold text-xs md:text-sm text-slate-200">${race.name}</div></div>`).join('');
            const createStatControl = (key, label, color) => `<div class="mb-2 md:mb-3"><div class="flex justify-between items-center text-sm mb-1"><span class="text-slate-400 w-28">${label}</span><div class="flex items-center space-x-2 bg-slate-800 p-1 rounded"><button class="stat-btn w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 font-bold flex items-center justify-center leading-none" data-action="decrease-stat" data-stat="${key}" ${isPossession ? 'disabled' : ''}>-</button><span id="stat-added-${key}" class="w-4 text-center text-xs font-bold text-blue-300">0</span><button class="stat-btn w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 font-bold flex items-center justify-center leading-none" data-action="increase-stat" data-stat="${key}" ${isPossession ? 'disabled' : ''}>+</button></div><div class="font-bold text-slate-200 w-16 text-right" id="stat-final-${key}">50</div></div><div class="w-full bg-slate-800 rounded-full h-1.5 md:h-2"><div id="stat-bar-${key}" class="bg-${color}-500 h-1.5 md:h-2 rounded-full stat-bar-fill" style="width: 0%"></div></div></div>`;

            let originDescStr = '';
            let specialConfigHtml = '';

            // 💡 부모 선택에 따른 가문명 및 나이 제한 로직 추가
            let isFixedFamily = false;
            let fixedLastName = '';
            let maxAgeLimit = null;

            if (state.player.originType === 'npc_child' && state.player.parents) {
                isFixedFamily = true;
                fixedLastName = state.player.parents.father.lastName.trim();
                let adultAge = getAdultAge(state.player.parents.mother.race);
                maxAgeLimit = Math.min(state.player.parents.father.age, state.player.parents.mother.age) - adultAge;
                if (maxAgeLimit < 1) maxAgeLimit = 1;
            } else if (state.player.originType === 'isekai') {
                let sel = document.getElementById('sel-reincarnation-parent');
                if (sel && sel.value) {
                    let pNpc = state.npcs.find(n => n.id === sel.value);
                    if (pNpc) {
                        isFixedFamily = true;
                        fixedLastName = pNpc.lastName.trim();
                        maxAgeLimit = pNpc.age - getAdultAge(pNpc.race);
                        if (maxAgeLimit < 1) maxAgeLimit = 1;
                    }
                }
            }

            // 나이가 상한을 초과하면 강제 조정
            if (maxAgeLimit !== null && state.player.age > maxAgeLimit) {
                state.player.age = maxAgeLimit;
            }

            if (state.player.originType === 'isekai') {
                originDescStr = '이세계 환생자 (보너스 스탯 +10, 완벽한 커스터마이징)';
                // 성인 NPC만 가문 선택지에 등장하도록 수정
                let parentOpts = state.npcs.filter(n => n.age >= getAdultAge(n.race)).slice(0, 15).map(n => `<option value="${n.id}">${n.name} (${n.lastName.trim()} 가문, ${RACES[n.race] ? RACES[n.race].name : '알수없음'})</option>`).join('');
                specialConfigHtml = `<div class="mb-4 p-3 bg-purple-900/30 border border-purple-500/50 rounded text-sm text-purple-200"><div class="font-bold mb-2 flex items-center"><span class="mr-2">👨‍👩‍👧</span> 태어날 가문 선택 (선택 시 종족/성씨 고정)</div><select id="sel-reincarnation-parent" class="w-full bg-slate-800 border border-slate-600 rounded p-1 text-white"><option value="">-- 고아로 환생 --</option>${parentOpts}</select></div>`;
            } else if (state.player.originType === 'regression') {
                // ... (기존과 동일) ...
                originDescStr = '회귀자 (역사의 흐름 속으로 되돌아갑니다)';
                specialConfigHtml = `<div class="mb-4 p-3 bg-orange-900/30 border border-orange-500/50 rounded text-sm text-orange-200"><div class="font-bold mb-2 flex items-center justify-between"><span><span class="mr-2">⏳</span> 회귀할 시점 선택</span><span class="text-white font-black" id="ui-regression-val">${state.player.regressionYear}년</span></div><input type="range" id="sel-regression-year" min="52" max="1052" step="10" value="${state.player.regressionYear}" class="w-full"><p class="text-xs text-orange-300 mt-2 opacity-80">선택한 연도로 세계의 시간이 롤백되어 시작됩니다.</p></div>`;
            } else if (state.player.originType === 'possession') {
                // ... (기존과 동일) ...
                originDescStr = '빙의자 (타인의 삶을 빼앗습니다)';
                let npcOpts = state.npcs.slice(0, 15).map(n => `<option value="${n.id}">${n.name} (${RACES[n.race] ? RACES[n.race].name : '알수없음'}, ${n.gender === 'M' ? '남' : '여'})</option>`).join('');
                specialConfigHtml = `<div class="mb-4 p-3 bg-rose-900/30 border border-rose-500/50 rounded text-sm text-rose-200"><div class="font-bold mb-2 flex items-center"><span class="mr-2">👻</span> 빙의할 육체 선택</div><select id="sel-possession-target" class="w-full bg-slate-800 border border-slate-600 rounded p-1 text-white"><option value="" disabled selected>-- 빙의 대상을 선택하세요 --</option>${npcOpts}</select></div>`;
            } else if (state.player.originType === 'npc_child') {
                originDescStr = `${state.player.parents.father.lastName.trim()} 가문의 자녀`;
            } else {
                originDescStr = '부모 미상의 고아';
            }

            // ... (HTML appEl.innerHTML 부분) ...
            appEl.innerHTML = `
                <div class="min-h-screen p-4 md:p-8 flex flex-col items-center justify-center animate-fade-in relative">
                    <div class="w-full max-w-6xl w-full flex justify-start mb-4 md:absolute md:top-6 md:left-6 md:mb-0 z-20"></div>
                    <div class="w-full max-w-6xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col md:flex-row md:h-[90vh] max-h-[90vh] overflow-y-auto md:overflow-hidden relative z-10">
                        <div class="w-full md:w-3/5 p-4 md:p-8 border-b md:border-b-0 md:border-r border-slate-700 flex flex-col md:overflow-y-auto md:h-full">
                            <div class="flex justify-between items-end border-b border-slate-700 pb-2 mb-4 shrink-0"><h2 class="text-xl md:text-2xl font-bold text-white flex items-center">인물 세부 설정 <span id="ui-adult-badge" class="ml-3 text-xs px-2 py-0.5 rounded bg-rose-900 text-rose-200 hidden border border-rose-500 text-adult">성인 모드</span></h2><div class="bg-blue-900/40 border border-blue-500/50 px-3 py-1 rounded text-sm text-blue-200 font-bold shadow-[0_0_10px_rgba(59,130,246,0.3)]">보너스 스탯: <span id="ui-points" class="text-xl text-white ml-1 font-fantasy tracking-wider">${totalBP}</span></div></div>
                            <div class="bg-slate-800/80 border border-slate-600 p-3 rounded text-sm text-slate-200 mb-4 font-bold flex items-center shrink-0"><span class="mr-2">🌟</span> 태생: ${originDescStr}</div>
                            ${specialConfigHtml}
                            
                            <div class="flex flex-col items-center mb-5 shrink-0 bg-slate-800/30 p-3 rounded-xl border border-slate-700">
                                <label class="block text-slate-400 text-xs font-bold mb-3">초상화 선택 (좌우 화살표 클릭)</label>
                                <div class="flex items-center gap-6">
                                    <button class="text-3xl text-slate-500 hover:text-white hover:scale-110 transition-all cursor-pointer p-2" data-action="prev-portrait">◀</button>
                                    <div id="creation-portrait" class="shadow-lg rounded-lg overflow-hidden border-2 border-slate-600">
                                        </div>
                                    <button class="text-3xl text-slate-500 hover:text-white hover:scale-110 transition-all cursor-pointer p-2" data-action="next-portrait">▶</button>
                                </div>
                                <div class="text-[10px] text-slate-500 mt-2">※ 종족/성별을 바꾸면 적용되는 이미지가 달라집니다.</div>
                            </div>

<div class="flex flex-col md:flex-row gap-3 md:gap-4 mb-3 shrink-0">
                                <div class="flex-1">
                                    <label class="block text-slate-400 text-xs font-bold mb-1.5">이름 (First Name) / 성씨 (가문명)</label>
                                    <div class="flex gap-2">
                                        <input type="text" id="player-first-name" value="${state.player.firstName || ''}" placeholder="이름" class="w-1/2 bg-slate-800 border border-slate-600 rounded py-2 px-3 text-white focus:outline-none focus:border-blue-500 transition-colors" autocomplete="off" ${isPossession?'disabled':''}>
                                        <input type="text" id="player-last-name" value="${isFixedFamily ? fixedLastName : (state.player.lastName ? state.player.lastName.trim() : '')}" placeholder="성씨" class="w-1/2 bg-slate-800 border border-slate-600 rounded py-2 px-3 ${isFixedFamily ? 'text-emerald-400 font-bold' : 'text-white'} focus:outline-none focus:border-blue-500 transition-colors" autocomplete="off" ${isPossession || isFixedFamily ? 'disabled' : ''}>
                                    </div>
                                </div>
                                <div class="w-full md:w-1/3">
                                    <label id="label-gender" class="block text-slate-400 text-xs font-bold mb-1.5 cursor-pointer select-none" title="클릭해보세요">성별</label>
                                    <div class="flex bg-slate-800 rounded border border-slate-600 overflow-hidden h-[38px]">
                                        <button id="gender-M" class="gender-btn flex-1 text-sm font-bold text-slate-400" data-gender="M" ${isPossession?'disabled':''}>남성</button>
                                        <button id="gender-F" class="gender-btn flex-1 text-sm font-bold text-slate-400" data-gender="F" ${isPossession?'disabled':''}>여성</button>
                                    </div>
                                </div>
                            </div>

                            <div class="grid grid-cols-3 gap-3 md:gap-4 mb-5 shrink-0">
                                <div>
                                    <label class="block text-slate-400 text-xs font-bold mb-1.5">나이</label>
                                    <div class="flex relative">
                                        <input type="number" id="player-age" value="${state.player.age}" max="${maxAgeLimit || 999}" class="w-full bg-slate-800 border border-slate-600 rounded py-1.5 px-2 text-white focus:outline-none focus:border-blue-500 text-center" ${isPossession?'disabled':''}>
                                        <span class="absolute right-2 top-2 text-xs text-slate-500 pointer-events-none">세</span>
                                    </div>
                                    ${maxAgeLimit ? `<div class="text-[10px] text-amber-400 mt-1 mt-1 leading-tight">부모 나이 고려<br>최대 ${maxAgeLimit}세</div>` : ''}
                                </div>
                                <div><label class="block text-slate-400 text-xs font-bold mb-1.5">신장</label><div class="flex relative"><input type="number" id="player-height" value="${state.player.height}" class="w-full bg-slate-800 border border-slate-600 rounded py-1.5 px-2 text-white focus:outline-none focus:border-blue-500 text-center" ${isPossession?'disabled':''}><span class="absolute right-2 top-2 text-xs text-slate-500 pointer-events-none">cm</span></div></div>
                                <div><label class="block text-slate-400 text-xs font-bold mb-1.5">체중</label><div class="flex relative"><input type="number" id="player-weight" value="${state.player.weight}" class="w-full bg-slate-800 border border-slate-600 rounded py-1.5 px-2 text-white focus:outline-none focus:border-blue-500 text-center" ${isPossession?'disabled':''}><span class="absolute right-2 top-2 text-xs text-slate-500 pointer-events-none">kg</span></div></div>
                            </div>
                            <div class="mb-5 shrink-0"><label class="block text-slate-400 text-xs font-bold mb-2">종족 <span id="race-lock-warning" class="text-red-400 text-[10px] ml-2 ${isChild||isPossession?'':'hidden'}">(혈통/육체 고정)</span></label><div class="grid grid-cols-4 gap-2">${raceButtonsHtml}</div></div>
                            <div class="mb-2 shrink-0 pb-4"><div class="flex justify-between items-center mb-3"><div><label id="label-traits" class="block text-slate-400 text-xs font-bold cursor-pointer select-none" title="운명을 고정할 수 있을지도 모릅니다...">운명의 특성 (선천적)</label></div><button id="btn-reroll-traits" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.5)] flex items-center transition-all active:scale-95" ${isPossession ? 'style="display:none;"' : ''}><span class="dice-icon mr-1 text-base">🎲</span> 운명 굴리기</button></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 min-h-[80px]" id="traits-container"></div></div>
                        </div>
                        <div class="w-full md:w-2/5 p-4 md:p-8 bg-slate-800/50 flex flex-col md:overflow-y-auto md:h-full shrink-0">
                            <h3 class="text-base md:text-lg font-bold text-white mb-3 md:mb-4 border-b border-slate-700 pb-2 flex justify-between items-end shrink-0"><span>최종 능력치</span><span class="text-yellow-400 text-sm md:text-base" id="ui-gold">500 G</span></h3>
                            <div class="mb-2 shrink-0">${createStatControl('str', '💪 근력 (물리/체력)', 'red')}${createStatControl('mag', '🔮 마력 (마법/정신력)', 'blue')}${createStatControl('agi', '⚡ 민첩 (속도/회피)', 'green')}${createStatControl('cha', '🗣️ 화술 (설득/매력)', 'purple')}</div>
                            <div id="ui-synergy-stats" class="mb-2 shrink-0"></div><div id="ui-hidden-stats" class="mb-4 bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-xs text-slate-400 shrink-0"></div>
                            
                            <div class="bg-slate-900/80 p-4 rounded-xl border border-slate-700 mb-4 md:mb-6 text-xs md:text-sm text-slate-300 text-center leading-relaxed h-auto shrink-0 min-h-[100px] flex items-center justify-center w-full">
                                <div id="ui-desc" class="w-full break-keep break-words whitespace-normal">"운명의 인도자여, 어떤 길을 걸으시겠습니까?"</div>
                            </div>
                            
                            <div class="mt-auto md:pt-4 border-t-0 md:border-t border-slate-700 pb-2 md:pb-0 shrink-0"><button id="btn-start-journey" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 md:py-4 px-4 rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all transform hover:-translate-y-1 active:translate-y-0">세계로 진입</button></div>
                        </div>
                    </div>
                </div>
            `;
            if (state.player.originType === 'isekai' && state.player.parents) {
                const sel = document.getElementById('sel-reincarnation-parent');
                if (sel) sel.value = state.player.parents;
            }
            updateCharacterUI();

        }

        function updateCharacterUI() {
            const {
                pointsLeft,
                traitBonus,
                finalStats,
                finalGold,
                synergies
            } = calculateCurrentState();
            const isPossession = state.player.originType === 'possession';
            const isChild = state.player.originType === 'npc_child';
            const isReincarnationParentSelected = state.player.originType === 'isekai' && document.getElementById('sel-reincarnation-parent')?.value;

            // 1. 단순 텍스트/숫자 업데이트 (깜빡임 없음)
            const pointsEl = document.getElementById('ui-points');
            if (pointsEl) pointsEl.innerText = pointsLeft;
            const goldEl = document.getElementById('ui-gold');
            if (goldEl) goldEl.innerText = `${finalGold} G`;

            // 2. 성인 모드 배지
            const adultBadge = document.getElementById('ui-adult-badge');
            if (adultBadge) {
                if (state.adultMode) adultBadge.classList.remove('hidden');
                else adultBadge.classList.add('hidden');
            }

            // 3. 성별 버튼 상태 업데이트
            const genderM = document.getElementById('gender-M');
            if (genderM) genderM.className = `gender-btn flex-1 text-sm font-bold text-slate-400 ${state.player.gender === 'M' ? 'selected' : 'hover:bg-slate-700'}`;
            const genderF = document.getElementById('gender-F');
            if (genderF) genderF.className = `gender-btn flex-1 text-sm font-bold text-slate-400 ${state.player.gender === 'F' ? 'selected' : 'hover:bg-slate-700'}`;

            // 4. 종족 카드 상태 업데이트
            Object.values(RACES).forEach(race => {
                const el = document.getElementById(`race-card-${race.id}`);
                if (el) {
                    if (state.player.race === race.id) el.classList.add('selected');
                    else el.classList.remove('selected');
                    if ((isPossession || isChild || isReincarnationParentSelected) && state.player.race !== race.id) el.classList.add('locked');
                    else el.classList.remove('locked');
                }
            });

            // 5. 💡 초상화 깜빡임 방지: ID가 바뀔 때만 새로 그림
            const portraitContainer = document.getElementById('creation-portrait');
            if (portraitContainer) {
                const currentImgId = `${state.player.race}_${state.player.gender}_${state.player.portraitId}`;
                if (portraitContainer.dataset.lastImgId !== currentImgId) {
                    portraitContainer.innerHTML = getPortraitHtml(state.player.race, state.player.gender, state.player.portraitId || 1, RACES[state.player.race]?.icon || '🧑', 'w-24 h-24');
                    portraitContainer.dataset.lastImgId = currentImgId;
                }
            }

            // 6. 💡 특성 깜빡임 방지: 잠금 상태(lockedTraitsList)는 키에서 제외하여 불필요한 전체 리렌더링 방지
            const traitsContainer = document.getElementById('traits-container');
            if (traitsContainer) {
                const traitsKey = state.player.traits.sort().join(',') + '_' + traitLockMode;

                if (traitsContainer.dataset.lastTraits !== traitsKey) {
                    if (state.player.traits.length === 0) {
                        traitsContainer.innerHTML = `<div class="col-span-full text-center text-slate-500 text-sm py-4 border border-dashed border-slate-700 rounded-lg">주사위를 굴려 운명을 확인하세요!</div>`;
                    } else {
                        traitsContainer.innerHTML = state.player.traits.map(traitId => {
                            const trait = TRAITS[traitId];
                            if (!trait) return '';
                            const styles = getTierStyles(trait.tier);
                            const adultClass = trait.reqAdult ? 'border-rose-800 bg-rose-950/20' : '';
                            let lockBtnHtml = '';
                            if (traitLockMode && trait.tier !== '유일') {
                                const isLocked = lockedTraitsList.includes(traitId);
                                lockBtnHtml = `<button class="absolute bottom-2 right-2 text-base z-10 p-1 hover:scale-110 transition-transform ${isLocked ? 'text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]' : 'text-slate-500 opacity-50 hover:opacity-100'}" data-action="toggle-lock-trait" data-trait="${traitId}">${isLocked ? '🔒' : '🔓'}</button>`;
                            }
                            return `<div class="trait-card p-2 md:p-3 rounded-lg flex flex-col items-start relative overflow-hidden ${styles.cardClass} ${adultClass}"><div class="absolute top-0 right-0 px-2 py-0.5 text-[10px] md:text-xs font-bold rounded-bl-lg ${styles.badgeClass}">${trait.tier}</div><div class="font-bold text-sm mb-1 mt-1 md:mt-2 w-full"><span class="mr-1">${trait.icon}</span> <span>${trait.name}</span></div><div class="text-[11px] md:text-xs opacity-80 leading-snug break-keep w-[90%]">${trait.desc}</div>${lockBtnHtml}</div>`;
                        }).join('');
                    }
                    traitsContainer.dataset.lastTraits = traitsKey;
                }
            }

            // 7. 스탯 수치 및 바 업데이트 (이 부분은 innerHTML 대신 innerText 사용으로 깜빡임 원천 차단)
            const statsArr = ['str', 'mag', 'agi', 'cha'];
            statsArr.forEach(key => {
                const addedEl = document.getElementById(`stat-added-${key}`);
                if (addedEl) addedEl.innerText = state.player.addedStats[key] > 0 ? `+${state.player.addedStats[key]}` : '0';

                const minusBtn = document.querySelector(`button[data-action="decrease-stat"][data-stat="${key}"]`);
                if (minusBtn) {
                    if (state.player.addedStats[key] <= 0 || isPossession) minusBtn.setAttribute('disabled', 'true');
                    else minusBtn.removeAttribute('disabled');
                }

                const plusBtn = document.querySelector(`button[data-action="increase-stat"][data-stat="${key}"]`);
                if (plusBtn) {
                    if (pointsLeft <= 0 || isPossession) plusBtn.setAttribute('disabled', 'true');
                    else plusBtn.removeAttribute('disabled');
                }

                const finalEl = document.getElementById(`stat-final-${key}`);
                if (finalEl) {
                    let bonusText = '';
                    if (traitBonus[key] > 0) bonusText = `<span class="text-green-400 text-xs ml-1">(+${traitBonus[key]})</span>`;
                    if (traitBonus[key] < 0) bonusText = `<span class="text-red-400 text-xs ml-1">(${traitBonus[key]})</span>`;
                    finalEl.innerHTML = `${finalStats[key]} ${bonusText}`;
                }
                const barEl = document.getElementById(`stat-bar-${key}`);
                if (barEl) barEl.style.width = `${Math.min(100, (finalStats[key]/120)*100)}%`;
            });

            // 8. 시너지 및 히든 스탯
            const synEl = document.getElementById('ui-synergy-stats');
            if (synEl) {
                const synKey = synergies.map(s => s.name).join(',');
                if (synEl.dataset.lastSyn !== synKey) {
                    synEl.innerHTML = synergies.map(s => `<div class="bg-yellow-900/30 border border-yellow-500/50 p-2 rounded text-xs text-yellow-200 mb-1"><span class="font-bold">✨ 시너지: [${s.name}]</span><br>${s.desc}</div>`).join('');
                    synEl.dataset.lastSyn = synKey;
                }
            }

            const hiddenEl = document.getElementById('ui-hidden-stats');
            if (hiddenEl) {
                const hs = state.player.hiddenStats;
                // 히든 스탯은 수치가 자주 안변하므로 단순 텍스트 갱신
                hiddenEl.innerHTML = `<div class="font-bold text-slate-300 mb-1 border-b border-slate-700 pb-1">성향 (히든 스탯)</div><div class="grid grid-cols-2 gap-x-2 gap-y-1"><div>⚔️ 호전성: ${hs.aggression}</div><div>🤝 사교성: ${hs.sociability}</div><div>👑 야심: ${hs.ambition}</div><div>⚖️ 도덕성: ${hs.morality}</div><div class="${state.adultMode ? 'text-rose-400 font-bold' : ''}">💋 색욕: ${state.adultMode ? hs.lust : '???'}</div></div>`;
            }

            // 9. 설명 텍스트 업데이트
            const descEl = document.getElementById('ui-desc');
            if (descEl) {
                const firstNode = document.getElementById('player-first-name');
                const lastNode = document.getElementById('player-last-name');

                const rawFirst = firstNode ? firstNode.value.trim() : (state.player.firstName ? state.player.firstName.trim() : '');
                const rawLast = lastNode ? lastNode.value.trim() : (state.player.lastName ? state.player.lastName.trim() : '');

                // 한국어 성명 표기법처럼 성씨가 뒤에 오게 하거나, 띄어쓰기로 이어붙임 (NAME_DATA의 last는 " 팬드래건" 처럼 앞에 공백이 포함되어있음)
                const fullName = rawFirst + (rawLast ? " " + rawLast : "");
                const namePrefix = rawFirst ? `${fullName}여,` : `무명의 그대여,`;

                let originNarrative = "";
                switch (state.player.originType) {
                    case 'isekai':
                        originNarrative = "이계의 낯선 기억을 품고 새로운 별 아래 강림하였으니...";
                        break;
                    case 'regression':
                        originNarrative = "시간의 굴레를 거슬러 잊지 못할 숙원을 안고 다시 눈을 떴으니...";
                        break;
                    case 'possession':
                        originNarrative = "뒤틀린 운명의 틈새에서 타인의 생을 탐하여 숨을 쉬게 되었으니...";
                        break;
                    case 'npc_child':
                        originNarrative = "세월이 빚어낸 가문의 혈맥을 이어받아 서사시의 첫 장을 열었으니...";
                        break;
                    default:
                        originNarrative = "아무런 인연의 끈 없이 홀로 이 척박한 대륙에 던져졌으나...";
                        break;
                }

                descEl.innerHTML = `"${namePrefix}<br><span class="text-blue-400">${RACES[state.player.race]?.name || '알수없음'}</span>의 육신에 깃들어,<br><span class="text-slate-300">${originNarrative}</span><br>이제 당신만의 발자취를 에테리아에 새길지어다."`;
            }
        }

        function updateFacilityDetailPanel() {
            const modal = document.getElementById('facility-modal');
            const panel = document.getElementById('facility-modal-content');
            if (!modal || !panel) return;
            if (!state.selectedFacility) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                return;
            }

            const fac = BUILDINGS[state.selectedFacility.type];
            let actionHtml = '';

            const actions = FACILITY_ACTIONS[state.selectedFacility.type];
            if (actions && actions.length > 0) {
                actions.forEach(act => {
                    // 성인 모드 전용 행동 필터링
                    if (act.reqAdult !== undefined && act.reqAdult !== state.adultMode) return;

                    const extraData = `${act.statUp ? `data-statup="${act.statUp}"` : ''} ${act.getGold ? `data-getgold="${act.getGold}"` : ''}`;
                    if (act.cost > 0) {
                        // AP 소모 행동: 대기열 예약
                        actionHtml += `<button class="w-full mb-2 bg-slate-700 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded transition-colors text-sm shadow-md flex justify-between items-center" data-action="queue" data-type="interact" data-name="${act.name}" data-cost="${act.cost}" ${extraData}><span>${act.icon} ${act.name}</span><span class="text-xs bg-slate-800 px-2 py-0.5 rounded text-blue-300 border border-slate-500">${act.cost} AP</span></button>`;
                    } else if (act.goldCost > 0) {
                        // 즉시 골드 소모 행동
                        actionHtml += `<button class="w-full mb-2 bg-indigo-700 hover:bg-indigo-600 text-white font-bold py-3 px-4 rounded transition-colors text-sm shadow-md flex justify-between items-center" data-action="immediate" data-name="${act.name}" data-gold="${act.goldCost}" data-cost="0" ${extraData}><span>${act.icon} ${act.name}</span><span class="text-xs bg-yellow-900/80 px-2 py-0.5 rounded text-yellow-300 border border-yellow-600">${act.goldCost} G</span></button>`;
                    } else {
                        // 무료 행동: 즉시 실행
                        actionHtml += `<button class="w-full mb-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded transition-colors text-sm shadow-md flex justify-between items-center" data-action="immediate" data-name="${act.name}" data-cost="0" ${extraData}><span>${act.icon} ${act.name}</span><span class="text-xs bg-emerald-900/80 px-2 py-0.5 rounded text-emerald-300 border border-emerald-600">즉시</span></button>`;
                    }
                });
            } else {
                actionHtml = `<div class="bg-slate-800/80 border border-slate-700 p-4 rounded-lg text-center text-slate-400 text-sm font-bold">특별히 할 수 있는 행동이 없습니다.</div>`;
            }

            panel.innerHTML = `
                <div class="text-center mb-4"><div class="text-5xl mb-3 drop-shadow-lg">${fac ? fac.icon : '❓'}</div><h3 class="text-xl font-black text-white">${fac ? fac.name : state.selectedFacility.type}</h3></div>
                <div class="flex justify-center gap-3 mb-4"><span class="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">면적: ${state.selectedFacility.w} x ${state.selectedFacility.h} 타일</span><span class="text-xs bg-amber-900/50 border border-amber-700/50 px-2 py-1 rounded text-amber-300">규모 보너스: +${state.selectedFacility.sizeBonus}%</span></div>
                <p class="text-sm text-slate-300 leading-relaxed mb-4 text-center bg-black/20 p-4 rounded-xl border border-slate-700 shadow-inner">${fac ? fac.desc : ''}</p>
                <div class="mt-2 border-t border-slate-700 pt-3"><h4 class="text-xs font-bold text-slate-400 mb-2">시설 행동</h4>${actionHtml}</div>
                <div class="text-[11px] text-slate-500 mt-2">무료 행동은 즉시 실행되고, AP 소모는 대기열로 예약됩니다.</div>
            `;

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        // 간단한 DOM 헬퍼 (리팩토링용)
        function getEl(id) {
            return document.getElementById(id);
        }

        function clampValue(value, min, max) {
            return Math.min(max, Math.max(min, value));
        }

        function calcPanelHeight(panel, minHeight = 0) {
            if (!panel) return minHeight;
            const innerHeight = panel.firstElementChild ? panel.firstElementChild.scrollHeight : 0;
            return Math.max(panel.scrollHeight, innerHeight, minHeight);
        }

        function applyPanelState(panel, isOpen, openStyles, closedStyles) {
            if (!panel) return;
            const styles = isOpen ? openStyles : closedStyles;
            Object.keys(styles).forEach(key => {
                panel.style[key] = styles[key];
            });
        }

        // 상단 정보 드로어 열림/닫힘 처리
        function setTopBarDrawerOpen(isOpen) {
            const panel = getEl('topbar-panel');
            const handle = getEl('btn-topbar-handle');
            if (!panel) return;
            const targetHeight = calcPanelHeight(panel, 120);
            applyPanelState(panel, isOpen, {
                visibility: 'visible',
                pointerEvents: 'auto',
                maxHeight: `${targetHeight}px`,
                opacity: '1',
                transform: 'translateY(0) scale(1)',
                filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.45))'
            }, {
                maxHeight: '0px',
                opacity: '0',
                transform: 'translateY(-12px) scale(0.98)',
                filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))',
                pointerEvents: 'none',
                visibility: 'hidden'
            });
            const inner = panel.firstElementChild;
            if (inner) inner.style.pointerEvents = isOpen ? 'auto' : 'none';
            if (handle) {
                handle.classList.toggle('is-open', isOpen);
                handle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                const icon = handle.querySelector('.topbar-menu-icon');
                if (icon) icon.textContent = isOpen ? '✕' : '☰';
            }
        }

        // 상단 정보 드로어 이벤트 바인딩 (호버 + 클릭 + 모바일 스와이프)
        function initTopBarDrawer() {
            const drawer = getEl('topbar-drawer');
            const handle = getEl('btn-topbar-handle');
            const panel = getEl('topbar-panel');
            if (!drawer || !handle || drawer.dataset.bound) return;
            drawer.dataset.bound = 'true';

            // 버튼 클릭: 열림/닫힘 토글
            handle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = panel && panel.style.visibility === 'visible';
                state.topBarDrawerPinned = !(isVisible && state.topBarDrawerPinned);
                setTopBarDrawerOpen(state.topBarDrawerPinned);
            });

            // 바깥 클릭 시 닫기
            document.addEventListener('click', (e) => {
                if (!state.topBarDrawerPinned) return;
                if (handle.contains(e.target)) return;
                if (panel && panel.contains(e.target)) return;
                state.topBarDrawerPinned = false;
                setTopBarDrawerOpen(false);
            });
        }

        function bindModalCloseHandlers() {
            const bind = (btnId, modalId) => {
                const btn = getEl(btnId);
                const modal = getEl(modalId);
                if (!btn || !modal || btn.dataset.bound) return;
                btn.dataset.bound = 'true';
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                });
            };
            bind('btn-close-calendar', 'calendar-modal');
            bind('btn-close-npc-detail', 'npc-detail-modal');
        }

        // 대기열 드로어 열림/닫힘 처리 (호버로 자연스럽게 펼쳐짐)
        function setActionQueueOpen(isOpen) {
            const panel = document.getElementById('action-queue-panel');
            if (!panel) return;
            const maxH = Math.min(panel.scrollHeight, Math.floor(window.innerHeight * 0.6));
            applyPanelState(panel, isOpen, {
                maxHeight: `${maxH}px`,
                opacity: '1',
                transform: 'translateY(0)',
                pointerEvents: 'auto'
            }, {
                maxHeight: '0px',
                opacity: '0',
                transform: 'translateY(-6px)',
                pointerEvents: 'none'
            });
        }

        function initActionQueueDrawer() {
            const drawer = getEl('action-queue-drawer');
            if (!drawer || drawer.dataset.bound) return;
            drawer.dataset.bound = 'true';
            drawer.addEventListener('mouseenter', () => setActionQueueOpen(true));
            drawer.addEventListener('mouseleave', () => setActionQueueOpen(false));
            // 초기 상태는 접힘
            setActionQueueOpen(false);
        }

        // 드래그 후 가장 가까운 가장자리로 스냅(미끄러짐) 처리
        function snapToNearestEdge(panel, margin = 12) {
            const rect = panel.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const bottomBar = getEl('bottom-nav-bar');
            const bottomSafe = bottomBar ? (bottomBar.getBoundingClientRect().height + margin) : margin;
            const safeBottomEdge = vh - bottomSafe;

            const distances = [{
                edge: 'left',
                dist: rect.left
            }, {
                edge: 'right',
                dist: vw - rect.right
            }, {
                edge: 'bottom',
                dist: Math.max(0, safeBottomEdge - rect.bottom)
            }];
            distances.sort((a, b) => a.dist - b.dist);
            const edge = distances[0].edge;

            let targetLeft = rect.left;
            let targetTop = rect.top;
            if (edge === 'left') targetLeft = margin;
            if (edge === 'right') targetLeft = vw - rect.width - margin;
            if (edge === 'top') targetTop = margin;
            if (edge === 'bottom') targetTop = safeBottomEdge - rect.height;

            targetLeft = clampValue(targetLeft, margin, vw - rect.width - margin);
            targetTop = clampValue(targetTop, margin, safeBottomEdge - rect.height);

            panel.style.transition = 'left 260ms cubic-bezier(0.16, 0.84, 0.44, 1), top 260ms cubic-bezier(0.16, 0.84, 0.44, 1)';
            panel.style.left = `${Math.round(targetLeft)}px`;
            panel.style.top = `${Math.round(targetTop)}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        }

        function makeDockable(panelId, handleId) {
            const panel = document.getElementById(panelId);
            const handle = document.getElementById(handleId);
            if (!panel || !handle || panel.dataset.dockBound) return;
            panel.dataset.dockBound = 'true';

            let dragging = false;
            let startX = 0;
            let startY = 0;
            let startLeft = 0;
            let startTop = 0;

            const beginDrag = (clientX, clientY) => {
                const rect = panel.getBoundingClientRect();
                dragging = true;
                startX = clientX;
                startY = clientY;
                startLeft = rect.left;
                startTop = rect.top;
                panel.style.transition = 'none';
                panel.style.left = `${rect.left}px`;
                panel.style.top = `${rect.top}px`;
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
            };

            const moveDrag = (clientX, clientY) => {
                if (!dragging) return;
                const dx = clientX - startX;
                const dy = clientY - startY;
                panel.style.left = `${startLeft + dx}px`;
                panel.style.top = `${startTop + dy}px`;
            };

            const endDrag = () => {
                if (!dragging) return;
                dragging = false;
                snapToNearestEdge(panel);
                panel.dataset.userPositioned = 'true';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                document.removeEventListener('touchmove', onTouchMove);
                document.removeEventListener('touchend', onTouchEnd);
            };

            const onMouseMove = (e) => moveDrag(e.clientX, e.clientY);
            const onMouseUp = () => endDrag();
            const onTouchMove = (e) => {
                if (e.touches && e.touches[0]) moveDrag(e.touches[0].clientX, e.touches[0].clientY);
            };
            const onTouchEnd = () => endDrag();

            handle.addEventListener('mousedown', (e) => {
                if (e.target.closest('button, input, select, textarea, a')) return;
                e.preventDefault();
                beginDrag(e.clientX, e.clientY);
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            handle.addEventListener('touchstart', (e) => {
                if (!e.touches || !e.touches[0]) return;
                if (e.target.closest('button, input, select, textarea, a')) return;
                e.preventDefault();
                beginDrag(e.touches[0].clientX, e.touches[0].clientY);
                document.addEventListener('touchmove', onTouchMove, { passive: true });
                document.addEventListener('touchend', onTouchEnd);
            }, { passive: false });
        }

        function initDockablePanels() {
            makeDockable('minimap-panel', 'minimap-header');
            makeDockable('layer-controls', 'layer-controls-header');
            makeDockable('action-queue-drawer', 'action-queue-header');
        }

        function renderInGameLayout() {
            const genderText = state.player.gender === 'M' ? '남성' : '여성';
            const raceName = RACES[state.player.race] ? RACES[state.player.race].name : '알수없음';
            const ageText = state.player.age ? `${state.player.age}세` : '나이 불명';
            let pointsUI = '';
            if (state.player.originType === 'regression') pointsUI = `<span class="text-orange-400 font-bold ml-2 bg-orange-900/30 px-2 py-0.5 rounded text-xs border border-orange-500/50">회귀력 ${state.player.rp}P</span>`;
            if (state.player.originType === 'possession') pointsUI = `<span class="text-purple-400 font-bold ml-2 bg-purple-900/30 px-2 py-0.5 rounded text-xs border border-purple-500/50">빙의력 ${state.player.pp}P</span>`;
            if (state.player.originType === 'isekai') pointsUI = `<span class="text-blue-400 font-bold ml-2 bg-blue-900/30 px-2 py-0.5 rounded text-xs border border-blue-500/50">환생력 ${state.player.ip}P</span>`;

            const calInfo = getCalendarInfo(state.gameDate);

            // 💡 반복되는 하단 네비게이션 버튼들을 배열 매핑으로 축약
            const navTabs = [{
                    id: 'city',
                    name: '지역(활동)'
                }, {
                    id: 'map',
                    name: '월드맵(탐색)'
                },
                {
                    id: 'character_info',
                    name: '내 정보'
                }, {
                    id: 'inventory',
                    name: '가방/장비'
                },
                {
                    id: 'relationships',
                    name: '세력/관계'
                }
            ];
            // 탭 값이 꼬여있으면 기본 맵으로 복구 (초보자에게도 안전한 기본값)
            const isValidTab = navTabs.some(t => t.id === state.inGameTab);
            if (!isValidTab) state.inGameTab = 'map';

            // 상단 정보 영역에서 쓸 플레이어 표시값 (없으면 안전하게 기본값)
            const playerName = state.player.name || state.player.firstName || '이름 없음';
            const playerTitle = (state.player.titles && state.player.titles.length > 0)
                ? state.player.titles[0]
                : (state.player.status || '무명');
            const navHtml = navTabs.map(t => `<button class="nav-btn px-3 md:px-6 py-2 md:py-3 bg-slate-700 hover:bg-slate-600 text-white text-xs md:text-base rounded font-bold transition-colors shrink-0 ${state.inGameTab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.name}</button>`).join('');

            // 💡 긴 HTML 문자열을 배열의 join('')으로 분리하여 코드 에디터에서 구조를 한눈에 볼 수 있도록 최적화
            appEl.innerHTML = [
                `<div class="min-h-screen flex flex-col bg-slate-900 animate-fade-in h-screen overflow-hidden relative">`,
                // 메인 뷰 (맵 & 탭 오버레이)
                `<div class="flex-1 relative overflow-hidden">`,
                `<div id="map-wrapper" class="absolute inset-0 overflow-auto bg-black map-container z-10 ${state.inGameTab === 'map' ? 'block' : 'hidden'}">`,
                `<div class="relative inline-block leading-none"><canvas id="world-canvas" class="block"></canvas><canvas id="player-canvas" class="absolute top-0 left-0 pointer-events-none"></canvas></div>`,
                `</div>`,
                `<div class="absolute bottom-4 right-4 flex space-x-2 z-20 ${state.inGameTab === 'map' ? 'flex' : 'hidden'}" id="zoom-controls">`,
                `<button id="btn-zoom-out" class="w-10 h-10 bg-slate-800/90 border border-slate-600 rounded-full text-white text-xl font-bold shadow-[0_0_10px_rgba(0,0,0,0.5)] hover:bg-slate-700 hover:border-blue-400 transition-colors flex items-center justify-center">-</button>`,
                `<button id="btn-zoom-in" class="w-10 h-10 bg-slate-800/90 border border-slate-600 rounded-full text-white text-xl font-bold shadow-[0_0_10px_rgba(0,0,0,0.5)] hover:bg-slate-700 hover:border-blue-400 transition-colors flex items-center justify-center">+</button>`,
                `</div>`,
                `<div id="minimap-panel" class="fixed top-20 right-4 bg-slate-900/85 border border-slate-700 rounded-lg shadow-lg z-20 ${state.inGameTab === 'map' ? 'block' : 'hidden'}">`,
                `<div class="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-slate-700/60 cursor-move select-none" id="minimap-header">`,
                `<span class="text-[11px] font-bold text-slate-300">미니맵</span>`,
                `<div class="flex items-center gap-2">`,
                `<span class="text-[10px] text-slate-500">WORLD</span>`,
                `<button id="btn-toggle-minimap" class="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors" title="접기/펼치기">${state.minimapCollapsed ? '>' : 'v'}</button>`,
                `</div>`,
                `</div>`,
                `<div id="minimap-body" class="p-2 ${state.minimapCollapsed ? 'hidden' : ''}">`,
                `<canvas id="minimap-canvas" width="160" height="160"></canvas>`,
                `</div>`,
                `</div>`,

                `<div class="fixed top-[230px] right-4 bg-slate-900/80 border border-slate-700 p-2 rounded-md shadow-lg z-20 ${state.inGameTab === 'map' ? 'block' : 'hidden'}" id="layer-controls">`,
                `<div class="flex items-center justify-between gap-2 cursor-move select-none" id="layer-controls-header">`,
                `<span class="text-[11px] font-bold text-slate-300">맵 레이어</span>`,
                `<button id="btn-toggle-layers" class="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors" title="접기/펼치기">${state.mapLayersCollapsed ? '>' : 'v'}</button>`,
                `</div>`,
                `<div id="layer-controls-body" class="${state.mapLayersCollapsed ? 'hidden' : 'mt-2 flex flex-col gap-2'}">`,
                `<label class="flex items-center space-x-2 text-sm text-white cursor-pointer"><input type="checkbox" class="layer-toggle" data-layer="borders" ${state.mapLayers.borders ? 'checked' : ''}><span class="text-green-400">영토 / 국경선</span></label>`,
                `<label class="flex items-center space-x-2 text-sm text-white cursor-pointer"><input type="checkbox" class="layer-toggle" data-layer="influence" ${state.mapLayers.influence ? 'checked' : ''}><span class="text-indigo-400">세력 영향권</span></label>`,
                `<label class="flex items-center space-x-2 text-sm text-white cursor-pointer"><input type="checkbox" class="layer-toggle" data-layer="mana" ${state.mapLayers.mana ? 'checked' : ''}><span class="text-purple-400">마나 포화도</span></label>`,
                `<label class="flex items-center space-x-2 text-sm text-white cursor-pointer"><input type="checkbox" class="layer-toggle" data-layer="light" ${state.mapLayers.light ? 'checked' : ''}><span class="text-yellow-400">반짝이는 빛</span></label>`,
                `</div>`,
                `</div>`,

                // 타일 상세 모달
                `<div id="tile-info-modal" class="absolute left-6 top-6 bg-slate-900 border-2 border-slate-500 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.8)] z-50 p-5 w-64 transform -translate-x-full opacity-0 transition-all duration-300 pointer-events-none">`,
                `<button id="btn-close-tile-modal" class="absolute top-2 right-2 text-slate-400 hover:text-white">✖</button>`,
                `<h3 id="modal-tile-name" class="text-xl font-bold text-white mb-1">지역 이름</h3><p id="modal-tile-coords" class="text-xs text-slate-500 mb-3">X: 0, Y: 0</p>`,
                `<div id="modal-tile-resource-container" class="mb-3 hidden"></div>`,
                `<div class="space-y-2 text-sm mb-4">`,
                `<div class="flex justify-between border-b border-slate-700 pb-1"><span class="text-slate-400">소속 국가</span><span id="modal-tile-nation" class="font-bold text-white">무소속</span></div>`,
                `<div class="flex justify-between border-b border-slate-700 pb-1"><span class="text-slate-400">정착지</span><span id="modal-tile-settlement" class="font-bold text-amber-300">없음</span></div>`,
                `<div class="flex justify-between border-b border-slate-700 pb-1"><span class="text-slate-400">영향권 소속</span><span id="modal-tile-influence" class="font-bold text-indigo-300">없음</span></div>`,
                `<div class="flex justify-between border-b border-slate-700 pb-1"><span class="text-slate-400">위협 정보</span><span id="modal-tile-threat" class="font-bold text-rose-300 text-right">없음</span></div>`,
                `<div class="flex justify-between border-b border-slate-700 pb-1"><span class="text-purple-400">마나 농도</span><span id="modal-tile-mana" class="font-bold text-purple-300">0%</span></div>`,
                `</div>`,
                `<div id="ui-move-panel" class="hidden flex-col items-center gap-2 mt-4 pt-4 border-t border-slate-700">`,
                `<div id="ui-move-cost" class="text-sm font-bold text-blue-300 text-center">이동 비용 계산 중...</div>`,
                `<button id="btn-move-here" class="w-full px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded shadow-[0_0_10px_rgba(37,99,235,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed">이곳으로 이동 예약</button>`,
                `</div>`,
                `</div>`,
                `<div id="ui-overlay-container" class="absolute inset-0 bg-slate-900/95 backdrop-blur-sm z-20 overflow-y-auto p-4 md:p-8 ${state.inGameTab !== 'map' ? 'block' : 'hidden'}"></div>`,
                `</div>`,

                // 모달 그룹 (축약 적용)
                `<div id="settlement-modal" class="fixed inset-0 bg-black/80 z-[100] hidden items-center justify-center animate-fade-in p-4"><div class="bg-slate-900 border-2 border-amber-600 rounded-xl shadow-[0_0_30px_rgba(217,119,6,0.5)] p-6 max-w-md w-full flex flex-col relative text-slate-300"><button id="btn-close-settlement" class="absolute top-4 right-4 text-slate-400 hover:text-white text-2xl leading-none">&times;</button><h3 class="text-2xl font-bold text-white mb-4 border-b border-slate-700 pb-2 flex items-center"><span id="settlement-modal-icon" class="mr-2 text-3xl"></span> <span id="settlement-modal-title"></span></h3><div id="settlement-modal-content" class="space-y-4 mt-2"></div></div></div>`,
                `<div id="calendar-modal" class="fixed inset-0 bg-black/80 z-[100] hidden items-center justify-center animate-fade-in p-4"><div class="bg-slate-900 border-2 border-indigo-500 rounded-xl shadow-[0_0_30px_rgba(99,102,241,0.5)] p-6 max-w-lg w-full flex flex-col relative text-slate-300"><button id="btn-close-calendar" class="absolute top-4 right-4 text-slate-400 hover:text-white text-2xl leading-none">&times;</button><h3 class="text-2xl font-bold text-white mb-4 border-b border-slate-700 pb-2">에테리아의 역법 (달력)</h3><div id="calendar-modal-content" class="space-y-4"></div></div></div>`,
                `<div id="debug-modal" class="fixed inset-0 bg-black/90 z-[200] hidden items-center justify-center animate-fade-in p-4"><div class="bg-slate-900 border-2 border-slate-600 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] p-4 md:p-6 max-w-6xl w-full h-[85vh] flex flex-col relative text-slate-300"><button id="btn-close-debug" class="absolute top-4 right-4 text-slate-400 hover:text-white text-3xl leading-none">&times;</button><h3 class="text-xl font-bold text-white mb-4 border-b border-slate-700 pb-2 flex items-center"><span class="mr-2">👁️</span> 시스템 로그 및 NPC 현황</h3><div id="debug-modal-content" class="flex flex-col md:flex-row gap-4 md:gap-6 h-full min-h-0 overflow-hidden"></div></div></div>`,
                `<div id="system-modal" class="fixed inset-0 bg-black/90 z-[300] hidden items-center justify-center animate-fade-in p-4"><div class="bg-slate-900 border-2 border-slate-600 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] p-6 max-w-2xl w-full flex flex-col relative text-slate-300 max-h-[90vh]"><button id="btn-close-system" class="absolute top-4 right-4 text-slate-400 hover:text-white text-3xl leading-none">&times;</button><h3 class="text-2xl font-bold text-white mb-6 border-b border-slate-700 pb-3 flex items-center"><span class="mr-2">⚙️</span> 시스템 메뉴</h3><div class="flex-1 overflow-y-auto mb-6 custom-scroll pr-2 space-y-3" id="system-save-list"><div class="text-center text-slate-500 py-10">데이터를 불러오는 중...</div></div><div class="border-t border-slate-700 pt-4 flex justify-between"><button id="btn-to-title" class="bg-rose-900 hover:bg-rose-800 text-rose-200 px-6 py-2 rounded font-bold transition-colors border border-rose-700">타이틀로 돌아가기</button><button id="btn-resume-game" class="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded font-bold transition-colors">게임으로 돌아가기</button></div></div></div>`,
                `<div id="npc-detail-modal" class="fixed inset-0 bg-black/80 z-[210] hidden items-center justify-center animate-fade-in p-4"><div class="bg-slate-900 border-2 border-blue-500 rounded-xl shadow-[0_0_30px_rgba(59,130,246,0.5)] p-5 md:p-6 max-w-sm w-full flex flex-col relative text-slate-300"><button id="btn-close-npc-detail" class="absolute top-4 right-4 text-slate-400 hover:text-white text-2xl leading-none">&times;</button><h3 class="text-xl md:text-2xl font-bold text-white mb-4 border-b border-slate-700 pb-2" id="npc-detail-title">NPC 이름</h3><div id="npc-detail-content" class="space-y-3"></div></div></div>`,
                `<div id="item-detail-modal" class="fixed inset-0 bg-black/80 z-[300] hidden items-center justify-center animate-fade-in p-4"><div class="bg-slate-900 border-2 border-slate-500 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] p-5 md:p-6 max-w-sm w-full flex flex-col relative text-slate-300"><button id="btn-close-item-detail" class="absolute top-4 right-4 text-slate-400 hover:text-white text-2xl leading-none">&times;</button><div class="flex items-center mb-4 border-b border-slate-700 pb-3"><div id="item-detail-icon" class="text-5xl mr-4 drop-shadow-md"></div><div><h3 class="text-xl md:text-2xl font-bold text-white" id="item-detail-name">아이템 이름</h3><div class="text-xs text-slate-400 mt-1" id="item-detail-type">무기 (한손)</div></div></div><div id="item-detail-content" class="space-y-3 text-sm"></div></div></div>`,

                // 대기열 드로어 (좌측 호버 펼침)
                `<div id="action-queue-drawer" class="fixed left-3 top-20 z-30 pointer-events-auto w-64">`,
                `<div id="action-queue-header" class="w-full bg-gradient-to-r from-blue-900/90 to-slate-900/90 border border-slate-600 text-blue-100 font-bold text-xs px-3 py-2 rounded-lg shadow-md flex items-center gap-2 cursor-move select-none">`,
                `<span class="text-sm">⚡</span><span>대기열</span>`,
                `<span id="action-queue-count" class="ml-1 bg-blue-700/80 text-white text-[10px] px-1.5 py-0.5 rounded-full border border-blue-400/60">0</span>`,
                `<span class="ml-auto text-[10px] text-blue-200/90">AP: ${TURN_AP}/${TURN_AP}</span>`,
                `</div>`,
                `<div id="action-queue-panel" class="w-full mt-2 bg-slate-900/95 border border-slate-700 rounded-xl shadow-xl overflow-hidden backdrop-blur" style="max-height:0; opacity:0; transform: translateY(-6px);">`,
                `<div id="action-queue-container" class="flex flex-col gap-2 p-3 max-h-[55vh] overflow-y-auto"></div>`,
                `</div>`,
                `</div>`,
                `<div id="bottom-nav-bar" class="bg-slate-800 border-t border-slate-700 p-2 flex justify-center space-x-1 md:space-x-4 z-30 shrink-0 w-full overflow-x-auto">`,
                navHtml,
                `<div class="w-px bg-slate-600 mx-1 md:mx-2 shrink-0"></div>`,
                `<button id="btn-end-turn" class="px-3 md:px-8 py-2 md:py-3 bg-blue-700 hover:bg-blue-600 text-white text-xs md:text-base rounded-lg font-black transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)] transform hover:-translate-y-1 active:translate-y-0 relative overflow-hidden group shrink-0"><span class="relative z-10">턴 종료</span><div class="absolute inset-0 w-full h-full bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div></button>`,
                `</div>`,
                `</div>`,
                // 상단 정보 드로어 (메인 레이아웃과 완전히 분리)
                `<div id="topbar-drawer" class="fixed top-0 left-0 right-0 w-full z-40 pointer-events-auto min-h-[32px]">`,
                `<button id="btn-topbar-handle" class="topbar-menu-btn text-[11px] text-slate-200 hover:brightness-110 transition-all flex items-center justify-center" aria-expanded="false"><span class="topbar-menu-icon text-base leading-none">☰</span><span class="font-bold">정보</span></button>`,
                `<div id="topbar-panel" class="transition-all duration-300 overflow-hidden" style="max-height:0; opacity:0; transform: translateY(-8px); pointer-events:none;">`,
                `<div class="topbar-panel-inner">`,
                `<div class="topbar-card-grid">`,
                `<div id="ui-date-display" class="topbar-card">`,
                `<div class="topbar-card-title">날짜</div>`,
                `<div id="btn-show-calendar-info" class="cursor-pointer group">`,
                `<div class="text-cyan-300 font-fantasy font-bold text-sm md:text-base tracking-wider leading-tight">대륙력 ${state.gameDate.year}년 ${state.gameDate.month}월</div>`,
                `<div class="text-[10px] md:text-xs text-slate-400">${calInfo.monthName}의 달 · ${calInfo.seasonName}</div>`,
                `<div class="text-[10px] md:text-xs text-slate-500">${state.gameDate.week}주차 [${calInfo.weekName}의 주] <span class="text-slate-400 group-hover:text-cyan-200">ℹ️</span></div>`,
                `</div>`,
                `</div>`,
                `<div class="topbar-card">`,
                `<div class="topbar-card-title">현재 타일</div>`,
                `<div id="ui-terrain-info" class="font-bold text-sm text-slate-100">-</div>`,
                `</div>`,
                `<div class="topbar-card">`,
                `<div class="topbar-card-title">내 정보</div>`,
                `<div class="flex items-center justify-between gap-3">`,
                `<div class="text-left leading-tight">`,
                `<div id="ui-player-name" class="text-white font-bold text-sm">${playerName}</div>`,
                `<div id="ui-player-title" class="text-[10px] text-slate-400">${playerTitle}</div>`,
                `</div>`,
                `<div class="text-yellow-300 font-bold text-sm" id="topbar-gold">${state.player.gold} G</div>`,
                `</div>`,
                `<div class="flex items-center gap-2 flex-wrap">`,
                pointsUI,
                `<button id="btn-open-debug" class="w-8 h-8 bg-slate-700/80 hover:bg-slate-600 text-white rounded-full text-sm font-bold shadow-md transition-colors" title="디버그/로그">👁️</button>`,
                `<button id="btn-open-system" class="w-8 h-8 bg-slate-700/80 hover:bg-slate-600 text-white rounded-full text-sm font-bold shadow-md transition-colors" title="시스템 메뉴">⚙️</button>`,
                `</div>`,
                `</div>`,
                `</div>`,
                `</div>`,
                `</div>`
            ].join('');

            // 상단 정보 드로어 초기화
            initTopBarDrawer();
            setTopBarDrawerOpen(state.topBarDrawerPinned);
            bindModalCloseHandlers();
            initActionQueueDrawer();
            initDockablePanels();

            drawCanvasMap();
            updateInGameOverlay(true);
            renderActionQueueBar();
            scheduleMiniMapUpdate();
        }

        async function renderSystemModalContent() {
            const container = document.getElementById('system-save-list');
            if (!container) return;

            try {
                const saveList = await AetheriaSaveManager.getSaveList();
                let html = '';

                const renderSlot = (id, label) => {
                    const save = saveList.find(s => s.slotId === id);
                    if (save) {
                        const date = new Date(save.timestamp).toLocaleString('ko-KR');
                        return `
                            <div class="save-slot bg-slate-800 border border-slate-600 p-4 rounded-lg flex justify-between items-center group">
                                <div>
                                    <div class="font-bold text-white mb-1"><span class="text-blue-400 mr-2">[${label}]</span> ${save.summary}</div>
                                    <div class="text-xs text-slate-400">진행도: ${save.dateInfo} | 소지금: ${save.gold} G</div>
                                    <div class="text-[10px] text-slate-500 mt-1">저장 일시: ${date}</div>
                                </div>
                                <div class="flex gap-2">
                                    <button class="bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-bold shadow-md" data-action="save-slot" data-slot="${id}">저장</button>
                                    <button class="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded text-sm font-bold shadow-md" data-action="load-slot" data-slot="${id}">불러오기</button>
                                </div>
                            </div>
                        `;
                    } else {
                        return `
                            <div class="save-slot bg-slate-900 border border-dashed border-slate-700 p-4 rounded-lg flex justify-between items-center">
                                <div>
                                    <span class="text-slate-500 font-bold">[${label}] 빈 슬롯</span>
                                    <div class="text-[10px] text-slate-600 mt-1">저장된 데이터가 없습니다.</div>
                                </div>
                                <div class="flex gap-2">
                                    <button class="bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-bold shadow-md" data-action="save-slot" data-slot="${id}">여기에 저장</button>
                                </div>
                            </div>
                        `;
                    }
                };

                html += renderSlot('auto', '자동 저장');
                html += renderSlot('slot1', '슬롯 1');
                html += renderSlot('slot2', '슬롯 2');
                html += renderSlot('slot3', '슬롯 3');

                // 브라우저가 초기화될 것을 대비해 세이브 파일을 직접 백업하고 복구하는 UI 추가
                html += `
                    <div class="mt-6 pt-4 border-t border-slate-700">
                        <h4 class="text-white font-bold mb-3 flex items-center"><span class="text-blue-400 text-lg mr-2">💾</span> PC 파일로 확실하게 백업/복구</h4>
                        <p class="text-xs text-slate-400 mb-3">브라우저 환경에 따라 새로고침 시 저장이 날아갈 수 있습니다. 주기적으로 파일로 다운로드하여 보관하세요.</p>
                        <div class="flex flex-col gap-3">
                            <button id="btn-export-save" class="w-full bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 rounded-lg shadow-md transition-all transform hover:-translate-y-0.5">📥 현재 상태를 PC에 파일로 저장 (다운로드)</button>
                            
                            <div class="relative bg-slate-800 border-2 border-dashed border-slate-500 hover:border-emerald-400 rounded-lg p-4 text-center cursor-pointer transition-colors group mt-1">
                                <input type="file" id="input-save-file-system" accept=".json" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                                <span class="text-slate-300 group-hover:text-emerald-300 font-bold text-sm">📂 PC에서 세이브 파일 불러오기 (.json)</span>
                            </div>
                        </div>
                    </div>
                `;

                container.innerHTML = html;
            } catch (err) {
                container.innerHTML = `<div class="text-rose-500 text-center py-10">오류가 발생했습니다.<br>${err}</div>`;
            }
        }

        function updateInGameOverlay(forceCenter = false) {
            document.querySelectorAll('.nav-btn').forEach(btn => {
                if (btn.dataset.tab === state.inGameTab) btn.classList.add('active');
                else btn.classList.remove('active');
            });
             const mapWrapper = document.getElementById('map-wrapper');
             const overlay = document.getElementById('ui-overlay-container');
             const layerControls = document.getElementById('layer-controls');
             const zoomControls = document.getElementById('zoom-controls');
            const layerToggleBtn = document.getElementById('btn-toggle-layers');
            const layerControlsBody = document.getElementById('layer-controls-body');
            const minimapPanel = getEl('minimap-panel');
            const minimapToggleBtn = getEl('btn-toggle-minimap');
            const minimapBody = getEl('minimap-body');
            if (layerToggleBtn) {
                layerToggleBtn.onclick = () => {
                    // 맵 레이어 패널 접기/펼치기
                    state.mapLayersCollapsed = !state.mapLayersCollapsed;
                    if (layerControlsBody) {
                        layerControlsBody.className = state.mapLayersCollapsed
                            ? 'hidden'
                            : 'mt-2 flex flex-col gap-2';
                    }
                    layerToggleBtn.textContent = state.mapLayersCollapsed ? '>' : 'v';
                };
            }
            if (minimapToggleBtn) {
                minimapToggleBtn.onclick = () => {
                    state.minimapCollapsed = !state.minimapCollapsed;
                    if (minimapBody) {
                        minimapBody.className = state.minimapCollapsed ? 'p-2 hidden' : 'p-2';
                    }
                    minimapToggleBtn.textContent = state.minimapCollapsed ? '>' : 'v';
                    scheduleMiniMapUpdate();
                };
            }

            if (state.inGameTab === 'map') {
                mapWrapper.classList.remove('hidden');
                overlay.classList.add('hidden');
                 if (layerControls) {
                     layerControls.classList.remove('hidden');
                    layerControls.classList.add('block');
                 }
                if (minimapPanel) {
                    minimapPanel.classList.remove('hidden');
                    minimapPanel.classList.add('block');
                }
                if (zoomControls) {
                    zoomControls.classList.remove('hidden');
                    zoomControls.classList.add('flex');
                }
                if (forceCenter) setTimeout(centerMapOnPlayer, 10);
                drawCanvasMap();
                // 미니맵 갱신
                scheduleMiniMapUpdate();
                // 미니맵 아래로 레이어 패널 기본 정렬
                if (layerControls && minimapPanel && layerControls.dataset.userPositioned !== 'true' && minimapPanel.dataset.userPositioned !== 'true') {
                    const rect = minimapPanel.getBoundingClientRect();
                    layerControls.style.top = `${Math.round(rect.bottom + 8)}px`;
                    layerControls.style.right = '16px';
                    layerControls.style.left = 'auto';
                }
                // 탭 전환 시 상단 정보 드로어 상태 재적용
                setTopBarDrawerOpen(state.topBarDrawerPinned);
                return;
            }

            mapWrapper.classList.add('hidden');
            overlay.classList.remove('hidden');
             if (layerControls) {
                 layerControls.classList.add('hidden');
                layerControls.classList.remove('block');
             }
            if (minimapPanel) {
                minimapPanel.classList.add('hidden');
                minimapPanel.classList.remove('block');
            }
            if (zoomControls) {
                zoomControls.classList.add('hidden');
                zoomControls.classList.remove('flex');
            }
            const modal = document.getElementById('tile-info-modal');
            if (modal) {
                modal.classList.add('-translate-x-full', 'opacity-0', 'pointer-events-none');
                modal.classList.remove('translate-x-0', 'opacity-100', 'pointer-events-auto');
            }

            if (state.inGameTab === 'city') {
                const currentTile = state.worldMap[state.player.location.y][state.player.location.x];
                let nationName = currentTile.nationId ? state.history.nations.find(n => n.id === currentTile.nationId).name : '무소속';
                let currentSettlement = null;
                if (currentTile.settlementId) currentSettlement = state.settlements.find(s => s.id === currentTile.settlementId);

                // 💡 [추가] 현재 타일에 던전이 있는지 확인
                let currentDungeon = null;
                if (currentTile.dungeonId) currentDungeon = state.dungeons.find(d => d.id === currentTile.dungeonId);

                if (!currentSettlement) {
                    // 마을이 없을 때: 황무지 패널과 함께 던전 입구 패널 표시
                    let dungeonHtml = '';
                    if (currentDungeon) {
                        dungeonHtml = `
                            <div class="bg-slate-800 border border-rose-500/50 p-6 rounded-xl shadow-[0_0_30px_rgba(225,29,72,0.15)] mb-6 max-w-2xl mx-auto w-full transform hover:scale-[1.02] transition-all">
                                <div class="text-6xl mb-3 drop-shadow-md">${currentDungeon.icon}</div>
                                <h3 class="text-2xl font-bold text-rose-400 mb-2">[던전] ${currentDungeon.name}</h3>
                                <p class="text-sm text-slate-300 mb-6">${DUNGEON_THEMES[currentDungeon.themeId].desc}</p>
                                <button id="btn-enter-dungeon" data-dungeon-id="${currentDungeon.id}" class="w-full py-3 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-lg shadow-[0_0_15px_rgba(225,29,72,0.5)] transition-all flex justify-center items-center">
                                    <span class="mr-2 text-xl">⚔️</span> 던전 진입
                                </button>
                            </div>
                        `;
                    }

                    overlay.innerHTML = `
                        <div class="py-10 text-center flex flex-col items-center w-full">
                            ${dungeonHtml}
                            <div class="max-w-2xl w-full mx-auto p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
                                <div class="text-4xl mb-2 drop-shadow-md opacity-50">🍃</div>
                                <h2 class="text-xl font-bold text-white mb-2">${currentTile.name} (황무지)</h2>
                                <p class="text-sm text-slate-400 mb-4">척박한 땅입니다. 새로운 터전을 일구시겠습니까?</p>
                                <button id="btn-settle-here" class="px-6 py-3 bg-green-700 hover:bg-green-600 text-white font-bold rounded shadow-[0_0_10px_rgba(21,128,61,0.5)] transition-all transform hover:-translate-y-1">🚩 이곳에 정착하기</button>
                            </div>
                        </div>`;
                } else {
                    // 마을이 있을 때: 거점 UI 상단에 던전 입구 배너 표시
                    const st = SETTLEMENT_TIERS[currentSettlement.type];

                    let mapHtml = '';
                    if (state.showCityMap) {
                        mapHtml = `
                            <div class="relative h-full w-full">
                                <div id="city-map-wrapper" class="absolute inset-0 bg-[#1e293b] map-container overflow-auto rounded-xl border-4 border-slate-800 shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]"><canvas id="city-canvas" class="block"></canvas></div>
                                <div class="absolute bottom-4 left-4 flex space-x-2 z-20">
                                    <button id="btn-city-zoom-out" class="w-10 h-10 bg-slate-800/90 border border-slate-600 rounded-full text-white text-xl font-bold shadow-[0_0_10px_rgba(0,0,0,0.5)] hover:bg-slate-700 hover:border-amber-400 transition-colors flex items-center justify-center" title="축소하기">-</button>
                                    <button id="btn-city-zoom-in" class="w-10 h-10 bg-slate-800/90 border border-slate-600 rounded-full text-white text-xl font-bold shadow-[0_0_10px_rgba(0,0,0,0.5)] hover:bg-slate-700 hover:border-amber-400 transition-colors flex items-center justify-center" title="확대하기">+</button>
                                    <button id="btn-city-fit" class="w-10 h-10 bg-slate-800/90 border border-slate-600 rounded-full text-white text-sm font-bold shadow-[0_0_10px_rgba(0,0,0,0.5)] hover:bg-slate-700 hover:border-amber-400 transition-colors flex items-center justify-center" title="전체보기로 맞추기">⛶</button>
                                </div>
                            </div>
                        `;
                    } else {
                        mapHtml = `
                            <div class="h-full w-full flex items-center justify-center bg-slate-900/60 border border-slate-700 rounded-xl">
                                <div class="text-center text-slate-400">
                                    <div class="text-4xl mb-2 opacity-60">🗺️</div>
                                    <div class="text-sm">지도를 펼치면 건물을 클릭해 상호작용할 수 있습니다.</div>
                                </div>
                            </div>
                        `;
                    }

                    let dungeonBanner = '';
                    if (currentDungeon) {
                        dungeonBanner = `
                            <div class="bg-rose-900/30 border border-rose-500/50 p-4 rounded-xl mb-4 flex flex-col md:flex-row justify-between items-center w-full shadow-lg">
                                <div class="flex items-center mb-3 md:mb-0">
                                    <span class="text-4xl mr-4 drop-shadow-md">${currentDungeon.icon}</span>
                                    <div>
                                        <div class="text-rose-400 font-bold text-lg">[지하 미궁] ${currentDungeon.name}</div>
                                        <div class="text-xs text-slate-300">이 영지 지하에 위험한 던전이 잠들어 있습니다.</div>
                                    </div>
                                </div>
                                <button id="btn-enter-dungeon" data-dungeon-id="${currentDungeon.id}" class="bg-rose-700 hover:bg-rose-600 text-white text-sm font-bold py-3 px-6 rounded-lg shadow-[0_0_15px_rgba(225,29,72,0.4)] transition-all transform hover:-translate-y-1 w-full md:w-auto flex items-center justify-center"><span class="mr-2 text-lg">⚔️</span> 진입하기</button>
                            </div>
                        `;
                    }

                    overlay.innerHTML = `
                        <div class="w-full h-full flex flex-col">
                            ${dungeonBanner}
                            <div class="mb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                <div class="flex items-center gap-3">
                                    <div class="text-3xl">${st.icon}</div>
                                    <div>
                                        <div class="text-xl md:text-2xl font-black text-white">${currentSettlement.name}</div>
                                        <div class="text-xs text-slate-400 mt-1">${st.name} · 인구 ${currentSettlement.population.toLocaleString()}명 · 영토 ${currentSettlement.influencedTiles ? currentSettlement.influencedTiles.length : 1}칸 · 소속 ${nationName}</div>
                                    </div>
                                </div>
                                <div class="flex gap-2 shrink-0">
                                    <button id="btn-toggle-city-map" class="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2 px-4 rounded shadow-[0_0_10px_rgba(37,99,235,0.5)] transition-all flex items-center">
                                        ${state.showCityMap ? '🗺️ 지도 숨기기' : '🗺️ 지도 펼치기'}
                                    </button>
                                    <button id="btn-show-settlement-info" class="bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold py-2 px-4 rounded shadow-[0_0_10px_rgba(217,119,6,0.5)] transition-all">🔍 지역 정보</button>
                                </div>
                            </div>
                            <div class="flex-1 min-h-0 relative">
                                ${mapHtml}
                            </div>
                            <div class="text-[11px] text-slate-500 mt-2">건물을 클릭하면 상호작용 창이 팝업으로 열립니다.</div>
                        </div>
                        <div id="facility-modal" class="absolute inset-0 bg-black/60 hidden items-center justify-center z-50">
                            <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl relative">
                                <button id="btn-close-facility-modal" class="absolute top-3 right-3 text-slate-400 hover:text-white">✖</button>
                                <div id="facility-modal-content" class="max-h-[75vh] overflow-y-auto"></div>
                            </div>
                        </div>`;
                    setTimeout(() => {
                        if (state.showCityMap) {
                            drawCityMap(forceCenter);
                        }
                        updateFacilityDetailPanel();
                    }, 10);
                }
            } else if (state.inGameTab === 'character_info') {
                overlay.innerHTML = getCharacterInfoHtml();
            } else if (state.inGameTab === 'inventory') {
                overlay.innerHTML = getInventoryAndEquipHtml();
            } else if (state.inGameTab === 'relationships') {
                overlay.innerHTML = getRelationshipsHtml();
            }
            // 탭 전환 시 상단 정보 드로어 상태 재적용
            setTopBarDrawerOpen(state.topBarDrawerPinned);
        }

        // 💡 새롭게 추가된 '세력/관계' 탭 내용 생성 함수
        function getRelationshipsHtml() {
            const relTab = state.relationshipTab || 'nation'; // 기본값은 국가 정치판도

            // 💡 반복되는 탭 UI를 배열로 정리하여 글자수 압축 및 가독성 향상
            const relTabs = [{
                    id: 'nation',
                    name: '국가 정치판도'
                }, {
                    id: 'settlement',
                    name: '마을내 인원'
                },
                {
                    id: 'mercenary',
                    name: '영입한 용병단원'
                }, {
                    id: 'family',
                    name: '가족관계도'
                },
                {
                    id: 'etc',
                    name: '기타 (평판/악명)'
                }
            ];

            let tabsHtml = `<div class="flex space-x-2 border-b border-slate-700 mb-6 pb-2 overflow-x-auto custom-scroll w-full">` +
                relTabs.map(t => `<button class="rel-nav-btn px-4 py-2 rounded-t-lg font-bold text-sm transition-colors whitespace-nowrap ${relTab === t.id ? 'bg-indigo-600 text-white shadow-inner' : 'text-slate-400 hover:bg-slate-800'}" data-rel-tab="${t.id}">${t.name}</button>`).join('') +
                `</div>`;

            let contentHtml = '';

            if (relTab === 'nation') {
                let tileCounts = {};
                state.history.nations.forEach(n => tileCounts[n.id] = 0);
                state.worldMap.forEach(row => row.forEach(t => {
                    if (t.nationId) tileCounts[t.nationId]++;
                }));
                let sortedNations = state.history.nations.map(n => ({
                    ...n,
                    count: tileCounts[n.id]
                })).sort((a, b) => b.count - a.count);

                contentHtml = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">` + sortedNations.map((n, i) => `
                    <div class="bg-slate-800/80 p-4 rounded-xl border-l-4 shadow-md" style="border-color: ${n.color.replace('0.45', '1.0')}">
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="text-lg font-bold text-white">${i+1}위. ${n.name}</h4>
                            <span class="text-xs bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-300">영토: ${n.count}칸</span>
                        </div>
                        <p class="text-sm text-slate-400 mb-3">${n.desc}</p>
                    </div>
                `).join('') + `</div>`;

            } else if (relTab === 'settlement') {
                const loc = state.player.location;
                if (!loc) {
                    contentHtml = `<div class="text-center text-slate-500 py-20">현재 위치를 알 수 없습니다.</div>`;
                } else {
                    const tile = state.worldMap[loc.y][loc.x];
                    if (tile.settlementId) {
                        const s = state.settlements.find(sett => sett.id === tile.settlementId);
                        const npcsInTown = state.npcs.filter(n => n.location && state.worldMap[n.location.y][n.location.x].settlementId === s.id);

                        if (npcsInTown.length > 0) {
                            contentHtml = `
                                <div class="flex justify-between items-end mb-4 border-b border-slate-700 pb-2">
                                    <h4 class="text-lg font-bold text-amber-400 flex items-center"><span class="mr-2">🏘️</span> [${s.name}] 체류 중인 인물</h4>
                                    <span class="text-xs text-slate-400">총 ${npcsInTown.length}명 (클릭하여 상세 정보 보기)</span>
                                </div>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            ` + npcsInTown.map(npc => {
                                let rName = RACES[npc.race] ? RACES[npc.race].name : '알수없음';
                                let nName = npc.name || '무명';
                                let canReadMind = state.player.traits.includes('mind_reader');
                                let ambitionName = canReadMind ? (AMBITIONS[npc.ambition?.type]?.name || '평온한 삶') : '??? (알 수 없음)';

                                return `
                                    <div class="bg-slate-800 p-3 rounded-lg border border-slate-600 flex justify-between items-center text-sm cursor-pointer hover:border-blue-500 hover:bg-slate-700 transition-colors clickable-npc shadow-sm" data-npc-id="${npc.id}">
                                        <div>
                                            <div class="font-bold text-white mb-0.5 text-base">${nName} <span class="text-xs text-slate-400 font-normal ml-1">(${rName}/${npc.gender === 'M'?'남':'여'})</span></div>
                                            <div class="${canReadMind ? 'text-purple-400 font-bold' : 'text-slate-500'} text-xs">목표: ${ambitionName}</div>
                                        </div>
                                        <div class="text-2xl opacity-60 ml-2">🔍</div>
                                    </div>`;
                            }).join('') + `</div>`;
                        } else {
                            contentHtml = `<div class="text-center text-slate-500 py-20 flex flex-col items-center"><span class="text-5xl mb-4 opacity-50">🍃</span><div>[${s.name}]에 머무는 네임드 인물이 없습니다.</div></div>`;
                        }
                    } else {
                        contentHtml = `<div class="text-center text-slate-500 py-20 flex flex-col items-center"><span class="text-5xl mb-4 opacity-50">🏕️</span><div>정착지가 아닌 야생에 있습니다.<br>인물을 찾으려면 마을이나 도시로 들어가세요.</div></div>`;
                    }
                }

            } else if (relTab === 'mercenary') {
                contentHtml = `<div class="text-center py-20 text-slate-500 flex flex-col items-center"><div class="text-6xl mb-4 drop-shadow-md">🛡️</div><h4 class="text-xl font-bold text-white mb-2">고용된 용병이 없습니다</h4><p class="text-sm">주점이나 길드 사무소에서 든든한 용병을 영입해 파티를 꾸려보세요.</p></div>`;
            } else if (relTab === 'family') {
                let parentsInfo = '';
                if (state.player.parents) {
                    parentsInfo = `
                        <div class="mb-6 bg-slate-800 p-5 rounded-xl border border-slate-600 shadow-md">
                            <h5 class="text-base font-bold text-emerald-400 mb-3 flex items-center"><span class="mr-2">👨‍👩‍👧</span> 나의 뿌리 (부모)</h5>
                            <div class="flex gap-4">
                                <div class="flex-1 bg-slate-900 p-4 rounded border border-slate-700 clickable-npc cursor-pointer hover:border-blue-500 transition-colors shadow-inner" data-npc-id="${state.player.parents.father.id}">
                                    <div class="text-xs text-slate-500 mb-1">아버지</div><div class="text-white font-bold text-lg">${state.player.parents.father.name}</div>
                                </div>
                                <div class="flex-1 bg-slate-900 p-4 rounded border border-slate-700 clickable-npc cursor-pointer hover:border-blue-500 transition-colors shadow-inner" data-npc-id="${state.player.parents.mother.id}">
                                    <div class="text-xs text-slate-500 mb-1">어머니</div><div class="text-white font-bold text-lg">${state.player.parents.mother.name}</div>
                                </div>
                            </div>
                        </div>`;
                }
                contentHtml = `${parentsInfo}<div class="text-center py-16 text-slate-500 flex flex-col items-center bg-slate-800/50 rounded-xl border border-slate-700 border-dashed"><div class="text-6xl mb-4 drop-shadow-md">💍</div><h4 class="text-xl font-bold text-white mb-2">배우자 및 자녀</h4><p class="text-sm">아직 깊은 인연을 맺은 이가 없습니다.</p></div>`;
            } else if (relTab === 'etc') {
                contentHtml = `<div class="bg-slate-800 p-6 rounded-xl border border-slate-600 shadow-md"><h4 class="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">기타 관계 및 세간의 평판</h4><div class="grid grid-cols-2 gap-6 text-center"><div class="bg-slate-900 p-6 rounded-xl border border-rose-900 shadow-inner"><div class="text-slate-400 mb-2 font-bold text-sm">현상금 (악명)</div><div class="text-rose-400 font-black text-3xl">0 G</div><div class="text-[10px] text-slate-500 mt-2">범죄를 저지르면 수배지가 붙습니다.</div></div><div class="bg-slate-900 p-6 rounded-xl border border-blue-900 shadow-inner"><div class="text-slate-400 mb-2 font-bold text-sm">모험가 랭크</div><div class="text-blue-400 font-black text-3xl">F 급</div><div class="text-[10px] text-slate-500 mt-2">길드 의뢰를 통해 승급할 수 있습니다.</div></div></div></div>`;
            }

            return `
                <div class="max-w-4xl mx-auto bg-slate-900/90 border border-slate-600 rounded-2xl p-6 shadow-2xl flex flex-col mt-4 min-h-[600px]">
                    <h3 class="text-3xl font-black text-white mb-4 flex items-center"><span class="mr-3 drop-shadow-lg">🤝</span> 세력 및 인물 관계도</h3>
                    <p class="text-sm text-slate-400 mb-6">대륙의 판도와 당신이 맺은 인연, 그리고 평판을 확인합니다.</p>
                    ${tabsHtml}
                    <div class="flex-1 overflow-y-auto pr-2 custom-scroll">${contentHtml}</div>
                </div>
            `;
        }

        function getCharacterInfoHtml() {
            const {
                finalStats
            } = calculateCurrentState();
            let traitsStr = state.player.traits.map(tId => TRAITS[tId] ? `<span class="inline-block bg-slate-700 rounded px-2 py-1 text-xs mr-2 mb-2">${TRAITS[tId].icon} ${TRAITS[tId].name}</span>` : '').join('');
            if (!traitsStr) traitsStr = '<span class="text-slate-500 text-sm">특성 없음</span>';

            return `
                <div class="max-w-2xl mx-auto bg-slate-800/90 border border-slate-600 rounded-xl p-8 shadow-xl flex flex-col mt-4">
                    <h3 class="text-2xl font-bold text-white mb-6 border-b border-slate-700 pb-3 text-center">내 정보</h3>
                    <div class="flex flex-col items-center text-center mb-8">
                        ${getPortraitHtml(state.player.race, state.player.gender, state.player.portraitId || 1, RACES[state.player.race]?.icon || '🧑', 'w-32 h-32 rounded-lg mb-4')}
                        <div class="text-3xl font-black text-white mb-1">${state.player.name}</div>                        <div class="text-base text-slate-400">${RACES[state.player.race] ? RACES[state.player.race].name : '알수없음'} / ${state.player.gender === 'M' ? '남성' : '여성'} / ${state.player.age}세</div>
                        <div class="text-sm text-emerald-300 mt-1">건강: ${Math.max(0, state.player.health ?? 100)}</div>
                        <div class="text-base text-slate-400 mt-1">${state.player.height}cm / ${state.player.weight}kg</div>
                    </div>
                    
                    <div class="mb-8">
                        <div class="text-base font-bold text-slate-400 mb-3 border-b border-slate-700 pb-1">능력치</div>
                        <div class="grid grid-cols-2 gap-4 text-lg">
                            <div class="bg-slate-900/50 p-3 rounded text-center">💪 근력: <span class="text-red-400 font-bold">${finalStats.str}</span></div>
                            <div class="bg-slate-900/50 p-3 rounded text-center">🔮 마력: <span class="text-blue-400 font-bold">${finalStats.mag}</span></div>
                            <div class="bg-slate-900/50 p-3 rounded text-center">⚡ 민첩: <span class="text-green-400 font-bold">${finalStats.agi}</span></div>
                            <div class="bg-slate-900/50 p-3 rounded text-center">🗣️ 화술: <span class="text-purple-400 font-bold">${finalStats.cha}</span></div>
                        </div>
                    </div>

                    <div class="mb-8">
                        <div class="text-base font-bold text-slate-400 mb-3 border-b border-slate-700 pb-1">성향 (히든 스탯)</div>
                        <div class="grid grid-cols-2 gap-3 text-base text-slate-300 bg-slate-900/50 p-4 rounded">
                            <div>호전성: ${state.player.hiddenStats.aggression}</div>
                            <div>사교성: ${state.player.hiddenStats.sociability}</div>
                            <div>야심: ${state.player.hiddenStats.ambition}</div>
                            <div>도덕성: ${state.player.hiddenStats.morality}</div>
                            ${state.adultMode ? `<div class="text-rose-400 font-bold col-span-2 pt-3 border-t border-slate-700/50 mt-2">색욕: ${state.player.hiddenStats.lust}</div>` : ''}
                        </div>
                    </div>

                    <div>
                        <div class="text-base font-bold text-slate-400 mb-3 border-b border-slate-700 pb-1">보유 특성</div>
                        <div class="flex flex-wrap">${traitsStr}</div>
                    </div>
                </div>
            `;
        }

        function getInventoryAndEquipHtml() {
            const eq = state.player.equipment;

            // 1. 장비 패널 HTML 구성
            const renderSlot = (key, label) => {
                const item = eq[key] ? ITEMS[eq[key]] : null;
                const dragAttr = item ? `draggable="true" ondragstart="handleDragStart(event, {source:'equipment', item: {id: '${item.id}'}, slotKey: '${key}'})" ondragend="handleDragEnd(event)" data-action="show-item" data-source="equipment" data-slot="${key}"` : '';
                return `
                    <div class="flex flex-col items-center">
                        <div class="w-14 h-14 bg-slate-900 border border-slate-600 rounded flex items-center justify-center text-3xl cursor-pointer hover:border-blue-400 hover:bg-slate-700 transition-colors shadow-inner relative group ${item ? 'clickable-item' : ''}" 
                             title="${item ? item.name : label}"
                             ondragover="handleDragOver(event)"
                             ondrop="handleDropOnEquipSlot(event, '${key}')"
                             ${dragAttr}>
                            ${item ? item.icon : `<span class="text-[10px] text-slate-500">${label}</span>`}
                            ${item ? `<div class="absolute -bottom-3 text-[10px] bg-black text-white px-1.5 py-0.5 rounded hidden group-hover:block whitespace-nowrap z-50 pointer-events-none">${label}</div>` : ''}
                        </div>
                    </div>
                `;
            };

            const tailSlot = RACES[state.player.race] && state.player.race === 'dragonborn' ? renderSlot('tail', '꼬리') : '';

            let adultSlotsHtml = '';
            if (state.adultMode) {
                // 성별에 따른 성인 슬롯 분기 처리
                let genderSpecificSlots = state.player.gender === 'F' ?
                    `${renderSlot('vagina', '질')} ${renderSlot('womb', '뱃속')}` :
                    `${renderSlot('penis', '양물')}`;

                adultSlotsHtml = `
                    <div class="col-span-full w-full border-t border-rose-900/50 mt-4 pt-3 text-center text-xs text-rose-400 font-bold mb-2">성인 전용 은밀한 슬롯</div>
                    <div class="flex justify-center gap-3 w-full mb-4">
                        ${genderSpecificSlots}
                        ${renderSlot('anus', '항문')}
                    </div>
                `;
            }

            const equipPanelHtml = `
                <div class="w-full lg:w-[380px] bg-slate-800/90 border border-slate-600 rounded-xl p-4 shadow-xl flex flex-col shrink-0">
                    <h3 class="text-xl font-bold text-white mb-4 border-b border-slate-700 pb-2 text-center shrink-0">장착 장비</h3>
                    <div class="flex flex-col gap-3 items-center shrink-0">
                        <div class="flex gap-3">${renderSlot('head', '투구')} ${renderSlot('face', '얼굴')}</div>
                        <div class="flex gap-5 w-full justify-center my-2">${renderSlot('left_hand', '왼손')} ${renderSlot('top', '상의')} ${renderSlot('right_hand', '오른손')}</div>
                        <div class="flex gap-3">${renderSlot('back', '등(가방)')} ${renderSlot('waist', '허리')}</div>
                        <div class="flex gap-3">${renderSlot('bottom', '하의')}</div>
                        <div class="flex gap-3">${renderSlot('left_thigh', '좌 허벅지')} ${renderSlot('right_thigh', '우 허벅지')}</div>
                        <div class="flex gap-3 mt-2">${renderSlot('feet', '신발')} ${tailSlot}</div>
                        
                        <div class="w-full border-t border-slate-700 mt-4 pt-3 text-center text-xs text-slate-400 font-bold mb-2">악세사리</div>
                        <div class="flex gap-3">${renderSlot('acc1', '악세1')} ${renderSlot('acc2', '악세2')} ${renderSlot('acc3', '악세3')}</div>
                        ${adultSlotsHtml}
                    </div>
                </div>
            `;

            // 2. 인벤토리 패널 HTML 구성 (클릭을 통한 상세정보 기능 추가)
            const getGridHtml = (invData, title, invName) => {
                if (!invData) return '';
                const cSize = 56; // 셀 픽셀 사이즈 
                let itemsHtml = invData.items.map((info, index) => {
                    const iDef = ITEMS[info.id];
                    if (!iDef) return '';
                    return `
                        <div class="absolute bg-slate-700/80 border border-slate-400 flex items-center justify-center text-3xl shadow-md cursor-grab hover:bg-blue-800/80 hover:border-blue-300 transition-colors group z-10 clickable-item" 
                             style="left: ${info.x * cSize}px; top: ${info.y * cSize}px; width: ${iDef.w * cSize}px; height: ${iDef.h * cSize}px;"
                             draggable="true" 
                             ondragstart="handleDragStart(event, {source:'${invName}', item: {id: '${info.id}'}, invIndex: ${index}})"
                             ondragend="handleDragEnd(event)"
                             data-action="show-item" data-source="${invName}" data-index="${index}">
                            <span class="drop-shadow-lg pointer-events-none">${iDef.icon}</span>
                            <span class="absolute bottom-0 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded hidden group-hover:block whitespace-nowrap pointer-events-none z-50">${iDef.name}</span>
                        </div>
                    `;
                }).join('');

                return `
                    <div class="mb-6 flex flex-col w-full items-center shrink-0">
                        <h4 class="text-sm font-bold text-slate-300 mb-2 text-center">${title}</h4>
                        <div class="w-full max-w-full overflow-x-auto flex justify-center pb-2 custom-scroll">
                            <div class="relative bg-slate-900/80 border-2 border-slate-600 rounded shadow-inner shrink-0" 
                                 style="width: ${invData.w * cSize}px; height: ${invData.h * cSize}px; background-image: linear-gradient(to right, rgba(71, 85, 105, 0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(71, 85, 105, 0.5) 1px, transparent 1px); background-size: ${cSize}px ${cSize}px;"
                                 ondragover="handleDragOver(event)"
                                 ondrop="handleDropOnInventory(event, '${invName}')">
                                ${itemsHtml}
                            </div>
                        </div>
                    </div>`;
            };

            const invPanelHtml = `
                <div class="w-full lg:flex-1 bg-slate-800/90 border border-slate-600 rounded-xl p-4 md:p-6 shadow-xl flex flex-col items-center min-w-0">
                    <h3 class="text-xl font-bold text-white mb-4 border-b border-slate-700 pb-2 w-full text-center shrink-0">소지품 (Grid Inventory)</h3>
                    <div class="text-xs text-slate-400 mb-6 bg-slate-900/50 p-3 rounded border border-slate-700 text-center w-full max-w-xl shrink-0">💡 아이템을 클릭하여 상세 정보를 보거나 드래그 앤 드롭으로 장착할 수 있습니다.</div>
                    
                    <div class="flex flex-wrap justify-center gap-6 w-full">
                        ${getGridHtml(state.player.baseInventory, '기본 소지품', 'baseInventory')}
                        ${state.player.equipment.back ? getGridHtml(state.player.bagInventory, `추가 가방 (${ITEMS[state.player.equipment.back]?.name || '배낭'})`, 'bagInventory') : ''}
                        ${state.player.equipment.left_thigh && ITEMS[state.player.equipment.left_thigh].bagGrid ? getGridHtml(state.player.leftThighInventory, `좌측 허벅지 (${ITEMS[state.player.equipment.left_thigh].name})`, 'leftThighInventory') : ''}
                        ${state.player.equipment.right_thigh && ITEMS[state.player.equipment.right_thigh].bagGrid ? getGridHtml(state.player.rightThighInventory, `우측 허벅지 (${ITEMS[state.player.equipment.right_thigh].name})`, 'rightThighInventory') : ''}
                    </div>
                </div>
            `;

            return `
                <div class="max-w-[1400px] w-full mx-auto flex flex-col xl:flex-row gap-6 items-start pb-20">
                    ${equipPanelHtml}
                    ${invPanelHtml}
                </div>
            `;
        }

        // ==========================================
        // 11. 전역 이벤트 리스너 등록
        // ==========================================
        appEl.addEventListener('click', async (e) => {
            const target = e.target;

            // 네비게이션 이벤트 (모드 화면, 백과사전, 뒤로가기 등)
            if (target.closest('#btn-boot-default') || target.closest('#btn-back-title-from-boot')) {
                state.screen = 'title';
                render();
                return;
            }
            if (target.closest('#btn-open-boot')) {
                state.screen = 'boot';
                render();
                return;
            }
            if (target.closest('#btn-dictionary')) {
                state.screen = 'dictionary';
                render();
                return;
            }
            if (state.screen === 'title' && target.closest('#btn-title-version')) {
                runCardFanShuffle('title-menu-fan', { withFlip: true });
                return;
            }
            if (target.closest('#btn-export-json')) {
                exportDefaultData();
                return;
            }
            if (target.closest('#btn-load-url')) {
                fetchModFromUrl();
                return;
            }

            if (target.closest('#btn-open-debug')) {
                const modal = document.getElementById('debug-modal');
                renderDebugModalContent();
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                return;
            }
            if (target.closest('#btn-close-debug')) {
                const modal = document.getElementById('debug-modal');
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                return;
            }
            if (target.closest('.clickable-npc')) {
                const npcId = target.closest('.clickable-npc').dataset.npcId;
                showNPCDetail(npcId);
                return;
            }
            if (target.closest('#btn-close-npc-detail')) {
                const modal = document.getElementById('npc-detail-modal');
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                return;
            }

            // 시스템 메뉴 열기 / 닫기
            if (target.closest('#btn-open-system')) {
                const modal = document.getElementById('system-modal');
                await renderSystemModalContent();
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                return;
            }
            if (target.closest('#btn-close-system') || target.closest('#btn-resume-game')) {
                const modal = document.getElementById('system-modal');
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                return;
            }
            if (target.closest('#btn-to-title')) {
                const modal = document.getElementById('system-modal');
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                state.screen = 'title';
                render();
                return;
            }

            // 수동 저장 / 불러오기
            if (target.closest('[data-action="save-slot"]')) {
                const slotId = target.closest('[data-action="save-slot"]').dataset.slot;
                try {
                    await AetheriaSaveManager.saveGame(slotId);
                    showToast(`게임이 [${slotId}]에 저장되었습니다.`);
                    renderSystemModalContent(); // 리스트 갱신
                } catch (err) {
                    alert("저장 실패: " + err);
                }
                return;
            }
            if (target.closest('[data-action="load-slot"]')) {
                const slotId = target.closest('[data-action="load-slot"]').dataset.slot;
                try {
                    const loadedState = await AetheriaSaveManager.loadGame(slotId);
                    if (loadedState) {
                        state = loadedState; // 전역 상태 덮어쓰기
                        showToast(`게임 데이터를 성공적으로 불러왔습니다.`);

                        // 모달 닫기
                        document.getElementById('system-modal')?.classList.add('hidden');
                        document.getElementById('system-modal')?.classList.remove('flex');
                        document.getElementById('load-modal')?.classList.add('hidden');
                        document.getElementById('load-modal')?.classList.remove('flex');

                        // UI 리렌더링
                        if (state.screen === 'world') {
                            renderInGameLayout();
                            centerMapOnPlayer();
                        } else {
                            render();
                        }
                    } else {
                        alert("저장된 데이터가 없습니다.");
                    }
                } catch (err) {
                    alert("불러오기 실패: " + err);
                }
                return;
            }

            // PC 파일로 세이브 다운로드
            if (target.closest('#btn-export-save')) {
                try {
                    const dataStr = JSON.stringify(state);
                    const blob = new Blob([dataStr], {
                        type: "application/json"
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Aetheria_Save_${state.gameDate.year}y_${state.gameDate.month}m.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast("현재 게임 상태가 PC에 다운로드 되었습니다.");
                } catch (e) {
                    alert("세이브 파일 생성 중 오류가 발생했습니다.");
                }
                return;
            }
            // 💡 [추가] 던전 진입 버튼 클릭 시
            if (target.closest('#btn-enter-dungeon')) {
                const dungeonId = target.closest('#btn-enter-dungeon').dataset.dungeonId;
                const dungeon = state.dungeons.find(d => d.id === dungeonId);

                if (dungeon) {
                    // 미로 뷰(View)가 제작되기 전까지 작동을 확인하기 위한 임시 처리 (삭제)
                    // showToast(`⚔️ [${dungeon.name}] 미궁으로 진입합니다! (미로 UI 렌더링 준비중...)`);
                    // state.currentDungeonId = dungeon.id;

                    // 💡 [수정] 오라 카드 기반 탐색 화면으로 즉시 전환
                    startDungeonExploration(dungeon.id);
                }
                return;
            }
            // 💡 [추가] 던전 내부 탭 전환 이벤트
            if (target.closest('.dungeon-tab-btn')) {
                const btn = target.closest('.dungeon-tab-btn');
                if (state.dungeonRun) {
                    state.dungeonRun.currentTab = btn.dataset.tab;
                    renderDungeonExplore();
                }
                return;
            }
            // 타이틀 화면에서 이어하기 클릭
            if (target.closest('#btn-load-game-title')) {
                openLoadModal();
                return;
            }
            if (target.closest('#btn-close-load')) {
                const modal = document.getElementById('load-modal');
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                return;
            }

            // 아이템 상세 정보 보기
            if (target.closest('[data-action="show-item"]')) {
                if (isDraggingItem) return; // 드래그 중일 때는 무시

                const el = target.closest('[data-action="show-item"]');
                const source = el.dataset.source;
                let itemObj = null;

                if (source === 'equipment') {
                    const slot = el.dataset.slot;
                    const itemId = state.player.equipment[slot];
                    if (itemId) {
                        itemObj = {
                            id: itemId,
                            durability: ITEMS[itemId].maxDurability
                        };
                    }
                } else {
                    const idx = parseInt(el.dataset.index);
                    itemObj = state.player[source].items[idx];
                }

                if (itemObj) {
                    const iDef = ITEMS[itemObj.id];
                    if (iDef) {
                        document.getElementById('item-detail-icon').innerText = iDef.icon;
                        document.getElementById('item-detail-name').innerText = iDef.name;

                        let typeName = iDef.type === 'hand' ? '무기(한손)' : iDef.type === 'head' ? '투구' : iDef.type === 'consumable' ? '소모품' : iDef.type;
                        document.getElementById('item-detail-type').innerText = `분류: ${typeName} | 소재: ${iDef.material || '일반'}`;

                        let statsStr = '';
                        if (iDef.stats) {
                            for (const [k, v] of Object.entries(iDef.stats)) {
                                statsStr += `<span class="bg-slate-800 px-2 py-1 rounded text-blue-300 border border-slate-600 mr-1 mt-1 inline-block">${k}: +${v}</span>`;
                            }
                        } else {
                            statsStr = '<span class="text-slate-500">스탯 보너스 없음</span>';
                        }

                        const currentDurability = itemObj.durability || iDef.maxDurability;
                        const durPercent = Math.max(0, Math.min(100, (currentDurability / iDef.maxDurability) * 100)) || 100;
                        let durColor = durPercent > 50 ? 'bg-green-500' : (durPercent > 20 ? 'bg-amber-500' : 'bg-rose-500');

                        document.getElementById('item-detail-content').innerHTML = `
                            <div class="mb-3 text-slate-300 leading-relaxed bg-black/30 p-3 rounded border border-slate-700">${iDef.desc || '설명이 없습니다.'}</div>
                            <div class="mb-3 border-t border-slate-700 pt-3">
                                <div class="text-xs text-slate-400 mb-1 font-bold">장비 스탯</div>
                                <div class="flex flex-wrap">${statsStr}</div>
                            </div>
                            <div class="border-t border-slate-700 pt-3">
                                <div class="flex justify-between text-xs text-slate-400 mb-1 font-bold"><span>현재 내구도</span><span class="${durPercent <= 20 ? 'text-rose-400' : 'text-white'}">${currentDurability} / ${iDef.maxDurability}</span></div>
                                <div class="w-full bg-slate-800 rounded-full h-2">
                                    <div class="${durColor} h-2 rounded-full transition-all" style="width: ${durPercent}%"></div>
                                </div>
                            </div>
                        `;
                        const modal = document.getElementById('item-detail-modal');
                        modal.classList.remove('hidden');
                        modal.classList.add('flex');
                    }
                }
                return;
            }
            if (target.closest('#btn-close-item-detail')) {
                const modal = document.getElementById('item-detail-modal');
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                return;
            }
            if (target.closest('#btn-close-facility-modal') || target.id === 'facility-modal') {
                const modal = document.getElementById('facility-modal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }
                state.selectedFacility = null;
                if (state.showCityMap) drawCityMap(false);
                return;
            }

            if (target.closest('[data-action="cancel-queue"]')) {
                const id = target.closest('[data-action="cancel-queue"]').dataset.id;
                state.player.actionQueue = state.player.actionQueue.filter(a => a.id !== id);
                renderActionQueueBar();
                drawCanvasMap(false);
                return;
            }
            if (target.closest('[data-action="queue"]')) {
                const btn = target.closest('[data-action="queue"]');
                const type = btn.dataset.type;
                const name = btn.dataset.name;
                const cost = parseInt(btn.dataset.cost);

                // 새로 추가된 스탯업, 골드 획득 데이터를 읽음
                const extraData = {};
                if (btn.dataset.statup) extraData.statUp = btn.dataset.statup;
                if (btn.dataset.getgold) extraData.getGold = parseInt(btn.dataset.getgold);

                enqueueAction(type, name, cost, extraData);
                return;
            }

            if (target.closest('[data-action="immediate"]')) {
                const btn = target.closest('[data-action="immediate"]');
                const name = btn.dataset.name;
                const goldCost = parseInt(btn.dataset.gold) || 0;
                const statUp = btn.dataset.statup;
                const getGold = btn.dataset.getgold ? parseInt(btn.dataset.getgold) : 0;

                if (goldCost > 0 && state.player.gold < goldCost) {
                    showToast(`골드가 부족합니다! (필요: ${goldCost} G)`);
                    return;
                }

                if (goldCost > 0) {
                    state.player.gold -= goldCost;
                }
                if (statUp) {
                    if (state.player.addedStats && state.player.addedStats[statUp] !== undefined) {
                        state.player.addedStats[statUp] += 1;
                    }
                    if (state.player.finalStats && state.player.finalStats[statUp] !== undefined) {
                        state.player.finalStats[statUp] += 1;
                    }
                }
                if (getGold) {
                    state.player.gold += getGold;
                }

                let goldText = '';
                if (goldCost > 0) goldText += ` -${goldCost} G`;
                if (getGold) goldText += `${goldText ? ',' : ''} ${getGold > 0 ? '+' : ''}${getGold} G`;
                showToast(`[즉시 완료] ${name}${goldText ? ` (${goldText.trim()})` : ''}`);

                const topbarGold = document.getElementById('topbar-gold');
                if (topbarGold) topbarGold.innerText = `${state.player.gold} G`;
                return;
            }

            if (target.closest('.clickable-building')) {
                const bType = target.closest('.clickable-building').dataset.buildingType;
                const modal = document.getElementById('settlement-modal');
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                const loc = state.player.location;
                if (loc) {
                    const tile = state.worldMap[loc.y][loc.x];
                    if (tile.settlementId) {
                        const s = state.settlements.find(sett => sett.id === tile.settlementId);
                        if (s && s.layoutData && s.layoutData.instances) {
                            const inst = s.layoutData.instances.find(i => i.type === bType);
                            if (inst) {
                                state.inGameTab = 'city';
                                state.selectedFacility = inst;
                                updateInGameOverlay(true);
                            } else {
                                showToast("해당 건물이 아직 지도에 건설되지 않았습니다.");
                            }
                        }
                    }
                }
                return;
            }

            if (target.closest('#btn-zoom-in')) {
                zoomMap(5);
                return;
            }
            if (target.closest('#btn-zoom-out')) {
                zoomMap(-5);
                return;
            }
            if (target.closest('#btn-city-zoom-in')) {
                zoomCityMap(5);
                return;
            }
            if (target.closest('#btn-city-zoom-out')) {
                zoomCityMap(-5);
                return;
            }
            if (target.closest('#btn-city-fit')) {
                // 전체보기 모드로 복귀
                state.cityMapAutoFit = true;
                fitCityMapToView();
                drawCityMap(false);
                return;
            }
            if (target.closest('#btn-toggle-city-map')) {
                state.showCityMap = !state.showCityMap;
                if (state.showCityMap) {
                    // 지도를 펼칠 때는 자동 맞춤으로 시작
                    state.cityMapAutoFit = true;
                }
                updateInGameOverlay(true);
                return;
            }

            // 💡 네비게이션 탭 전환 (월드맵 선택 시 자동 줌인 적용)
            if (target.closest('.nav-btn')) {
                const navBtn = target.closest('.nav-btn');
                const targetTab = navBtn.dataset.tab;
                state.inGameTab = targetTab;

                if (targetTab === 'city') {
                    state.selectedFacility = null;
                    updateInGameOverlay(true);
                } else if (targetTab === 'map') {
                    state.tileSize = 20; // 맵 탭 선택 시 배율 20으로 자동 줌인
                    updateInGameOverlay(true); // true 전달하여 내 위치로 화면 즉시 이동
                } else {
                    updateInGameOverlay(false);
                }
                return;
            }

            // 💡 관계도 서브 탭 전환
            if (target.closest('.rel-nav-btn')) {
                const btn = target.closest('.rel-nav-btn');
                state.relationshipTab = btn.dataset.relTab;
                updateInGameOverlay(false);
                return;
            }

            if (target.closest('#btn-show-settlement-info')) {
                const loc = state.player.location;
                if (loc) {
                    const tile = state.worldMap[loc.y][loc.x];
                    if (tile.settlementId) {
                        const s = state.settlements.find(sett => sett.id === tile.settlementId);
                        if (s) {
                            const st = SETTLEMENT_TIERS[s.type];
                            const modal = document.getElementById('settlement-modal');
                            document.getElementById('settlement-modal-icon').innerText = st.icon;
                            document.getElementById('settlement-modal-title').innerText = s.name;

                            let leaderName = "<span class='text-slate-500'>원주민 장로 (자체 자치)</span>";
                            if (s.leaderId === state.player.id) leaderName = `<span class="text-blue-400 font-bold">${state.player.name} (플레이어)</span>`;
                            else if (s.leaderId) {
                                let npc = state.npcs.find(n => n.id === s.leaderId);
                                if (npc) leaderName = `<span class="text-white">${npc.name || '무명'} (${RACES[npc.race] ? RACES[npc.race].name : '알수없음'})</span>`;
                            }
                            let nationName = tile.nationId ? state.history.nations.find(n => n.id === tile.nationId).name : '무소속';
                            let builtBadges = s.buildings.map(b => {
                                const bd = BUILDINGS[b];
                                return bd ? `<span class="inline-flex items-center gap-1 bg-slate-800 border border-slate-600 px-2 py-1 rounded text-xs text-slate-300 shadow-sm cursor-pointer hover:bg-slate-600 hover:text-white transition-colors clickable-building" data-building-type="${b}" title="${bd.desc} (클릭 시 이동)">${bd.icon} ${bd.name}</span>` : '';
                            }).join('');
                            let buildingsHtml = builtBadges ? `<div class="flex flex-wrap gap-1.5 mt-2 max-h-32 overflow-y-auto w-full justify-end">${builtBadges}</div>` : `<span class="text-slate-500 mt-2 block text-right w-full">없음</span>`;
                            let influenceSize = s.influencedTiles ? s.influencedTiles.length : 1;

                            document.getElementById('settlement-modal-content').innerHTML = `
                                <div class="flex justify-between border-b border-slate-700 pb-2"><span class="text-slate-400">규모 단계</span><span class="font-bold text-white">${st.name}</span></div>
                                <div class="flex justify-between border-b border-slate-700 pb-2"><span class="text-slate-400">총 인구수</span><span class="font-bold text-amber-300">${s.population.toLocaleString()} 명</span></div>
                                <div class="flex justify-between border-b border-slate-700 pb-2"><span class="text-slate-400">영토 크기</span><span class="font-bold text-indigo-400">${influenceSize} 칸</span></div>
                                <div class="flex justify-between border-b border-slate-700 pb-2"><span class="text-slate-400">소속 국가</span><span class="font-bold text-green-400">${nationName}</span></div>
                                <div class="flex justify-between border-b border-slate-700 pb-2"><span class="text-slate-400">영주 / 촌장</span><span class="font-bold text-right">${leaderName}</span></div>
                                <div class="pt-2"><span class="text-slate-400 text-sm block mb-1">보유 주요시설</span>${buildingsHtml}</div>
                            `;
                            modal.classList.remove('hidden');
                            modal.classList.add('flex');
                        }
                    }
                }
                return;
            }

            if (target.closest('#btn-close-settlement')) {
                const modal = document.getElementById('settlement-modal');
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                return;
            }

            if (target.closest('#btn-move-here')) {
                const btn = target.closest('#btn-move-here');
                const tx = parseInt(btn.dataset.targetX);
                const ty = parseInt(btn.dataset.targetY);
                if (!isNaN(tx) && !isNaN(ty)) {
                    const result = calculatePathAStar(state.player.location.x, state.player.location.y, tx, ty, false);
                    if (result) {
                        enqueueAction('travel', `좌표 (${tx},${ty}) 로 이동`, result.cost, {
                            path: result.path
                        });
                        const modal = document.getElementById('tile-info-modal');
                        if (modal) {
                            modal.classList.add('-translate-x-full', 'opacity-0', 'pointer-events-none');
                        }
                        drawCanvasMap(false);
                    }
                }
                return;
            }

            if (target.closest('#btn-settle-here')) {
                if (state.player.location) {
                    const loc = state.player.location;
                    const tile = state.worldMap[loc.y][loc.x];
                    if (!tile.settlementId) {
                        if (tile.influencedBy) {
                            showToast("다른 거점의 영향권 안에서는 정착할 수 없습니다.");
                        } else {
                            const s = createSettlement(generateSettlementName(), loc.x, loc.y, state.player.id, 1);
                            if (s) {
                                showToast("?닿납???덈줈???곌퀬吏濡??좏룷?덉뒿?덈떎!");
                                updateInGameOverlay(false);
                                drawCanvasMap(false);
                            }
                        }
                    }
                }
                return;
            }

            if (target.closest('#btn-show-calendar-info')) {
                const modal = document.getElementById('calendar-modal');
                const content = document.getElementById('calendar-modal-content');
                const calInfo = getCalendarInfo(state.gameDate);
                content.innerHTML = `<div class="bg-slate-800 p-3 rounded border border-slate-600"><h4 class="text-lg font-bold text-blue-400 mb-1">${calInfo.seasonName}</h4><p class="text-sm leading-relaxed">${calInfo.seasonDesc}</p></div><div class="bg-slate-800 p-3 rounded border border-slate-600"><h4 class="text-lg font-bold text-purple-400 mb-1">${state.gameDate.month}월: ${calInfo.monthName}의 달</h4><p class="text-sm leading-relaxed">${calInfo.monthDesc}</p></div><div class="bg-slate-800 p-3 rounded border border-slate-600"><h4 class="text-lg font-bold text-green-400 mb-1">${state.gameDate.week}주차: ${calInfo.weekName}의 주</h4><p class="text-sm leading-relaxed">${calInfo.weekDesc}</p></div>`;
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                return;
            }
            if (target.closest('#btn-close-calendar')) {
                const modal = document.getElementById('calendar-modal');
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                return;
            }

            if (target.closest('#btn-end-turn')) {
                if (state.isAnimating) return;
                processTurnExecution();
                return;
            }
            if (target.closest('#btn-start-flow')) {
                state.screen = 'history';
                render();
                initHistorySimulation();
                stepHistorySimulation();
                return;
            }
            if (target.closest('#btn-back-title') || target.closest('#btn-reset')) {
                if (state.history.intervalId) clearTimeout(state.history.intervalId);
                state.history.intervalId = null;
                state.history.isRunning = false;
                state.history.isPaused = false;
                state.history.isPausedForEvent = false;
                state.screen = 'title';
                render();
                return;
            }

            if (state.screen === 'history') {
                if (target.closest('#btn-history-pause')) {
                    if (state.history.isFinished) return;
                    if (state.history.isPausedForEvent) {
                        showToast('월드 이벤트를 먼저 선택해 주세요.');
                        return;
                    }
                    state.history.isPaused = !state.history.isPaused;
                    if (state.history.isPaused) {
                        if (state.history.intervalId) clearTimeout(state.history.intervalId);
                        state.history.intervalId = null;
                        showToast('역사 시뮬레이션이 일시정지되었습니다.');
                    } else {
                        showToast('역사 시뮬레이션을 재개합니다.');
                        if (state.history.isRunning) {
                            state.history.intervalId = setTimeout(stepHistorySimulation, state.history.turnIntervalMs || 700);
                        }
                    }
                    renderHistoryUI();
                    return;
                }
                if (target.closest('#btn-history-event')) {
                    if (state.history.isFinished) return;
                    if (!state.history.isPaused) {
                        showToast('일시정지 중에만 월드 이벤트를 선택할 수 있습니다.');
                        return;
                    }
                    if (state.history.isPausedForEvent) return;
                    state.history.pendingWorldEventChoices = generateHistoryWorldEventChoices();
                    state.history.isPausedForEvent = true;
                    state.history.logs.unshift(`[${state.gameDate.year + state.history.currentTurn}년] [시스템] 플레이어가 월드 이벤트 결정을 요청했습니다.`);
                    renderHistoryUI();
                    return;
                }
                if (target.closest('#btn-history-log')) {
                    openHistoryLogModal();
                    return;
                }
                if (target.closest('#btn-close-history-log')) {
                    closeHistoryLogModal();
                    return;
                }
                if (target.closest('#btn-history-end')) {
                    finalizeHistorySimulation();
                    const endBtn = document.getElementById('btn-history-end');
                    if (endBtn) endBtn.classList.add('hidden');
                    const startBtn = document.getElementById('btn-enter-origin');
                    startBtn.classList.remove('hidden');
                    startBtn.classList.add('animate-fade-in');
                    return;
                }
                if (target.closest('#btn-enter-origin')) {
                    generateOrigins();
                    state.screen = 'origin';
                    render();
                }
            }

            if (state.screen === 'origin') {
                if (target.closest('#btn-reroll-origin')) {
                    rerollOriginCards();
                }
                const originCard = target.closest('[data-origin-index]');
                if (originCard) {
                    handleOriginSelection(originCard.dataset.originIndex);
                }
            }

            if (state.screen === 'create') {
                // 💡 초상화 클릭 시 전체목록 모달 열기
                if (target.closest('#creation-portrait')) {
                    const modal = document.getElementById('portrait-selection-modal');
                    if (modal) {
                        const desc = document.getElementById('portrait-modal-desc');
                        if (desc) desc.innerText = `현재 조건: ${RACES[state.player.race]?.name || '알수없음'} / ${state.player.gender === 'M' ? '남성' : '여성'}`;

                        const grid = document.getElementById('portrait-grid-container');
                        let html = '';
                        for (let i = 1; i <= 30; i++) {
                            const isSelected = (state.player.portraitId || 1) === i;
                            const borderClass = isSelected ? 'border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)] scale-105' : 'border-slate-600 hover:border-blue-400 opacity-80 hover:opacity-100 hover:scale-105';
                            html += `
                                <div class="cursor-pointer transition-all rounded-lg border-2 ${borderClass} overflow-hidden bg-slate-800" data-action="select-portrait" data-id="${i}">
                                    ${getPortraitHtml(state.player.race, state.player.gender, i, RACES[state.player.race]?.icon || '🧑', 'w-full aspect-square')}
                                </div>
                            `;
                        }
                        grid.innerHTML = html;
                        modal.classList.remove('hidden');
                        modal.classList.add('flex');
                    }
                    return;
                }

                // 💡 초상화 목록 모달 닫기
                if (target.closest('#btn-close-portrait-modal')) {
                    const modal = document.getElementById('portrait-selection-modal');
                    if (modal) {
                        modal.classList.add('hidden');
                        modal.classList.remove('flex');
                    }
                    return;
                }

                // 💡 모달에서 특정 초상화 클릭하여 선택
                if (target.closest('[data-action="select-portrait"]')) {
                    const id = parseInt(target.closest('[data-action="select-portrait"]').dataset.id);
                    state.player.portraitId = id;
                    updateCharacterUI();

                    const modal = document.getElementById('portrait-selection-modal');
                    if (modal) {
                        modal.classList.add('hidden');
                        modal.classList.remove('flex');
                    }
                    return;
                }

                // 💡 기존 초상화 화살표 좌우 변경 이벤트 유지
                if (target.closest('[data-action="prev-portrait"]')) {
                    if (!state.player.portraitId) state.player.portraitId = 1;
                    state.player.portraitId--;
                    if (state.player.portraitId < 1) state.player.portraitId = 30;
                    updateCharacterUI();
                    return;
                }
                if (target.closest('[data-action="next-portrait"]')) {
                    if (!state.player.portraitId) state.player.portraitId = 1;
                    state.player.portraitId++;
                    if (state.player.portraitId > 30) state.player.portraitId = 1;
                    updateCharacterUI();
                    return;
                }

                // 💡 이스터에그 1: 특성 라벨 10번 클릭 시 락 모드 활성화
                if (target.closest('#label-traits')) {
                    traitLabelClickCount++;
                    if (traitLabelClickCount === 10) {
                        traitLockMode = !traitLockMode;
                        traitLabelClickCount = 0;
                        lockedTraitsList = []; // 모드 전환 시 기존 잠금 초기화
                        showToast(traitLockMode ? '✨ [운명 고정] 모드가 활성화되었습니다. 특성을 잠글 수 있습니다.' : '💨 [운명 고정] 모드가 비활성화되었습니다.');
                        updateCharacterUI();
                    }
                    return;
                }

                // 💡 이스터에그 2: 특성 잠금 버튼 클릭 시 (부분 업데이트로 깜빡임 완벽 제거)
                if (target.closest('[data-action="toggle-lock-trait"]')) {
                    const btn = target.closest('[data-action="toggle-lock-trait"]');
                    const tId = btn.dataset.trait;

                    if (lockedTraitsList.includes(tId)) {
                        // 잠금 해제
                        lockedTraitsList = lockedTraitsList.filter(id => id !== tId);

                        // DOM만 즉시 변경 (전체 렌더링 X)
                        btn.className = 'absolute bottom-2 right-2 text-base z-10 p-1 hover:scale-110 transition-transform text-slate-500 opacity-50 hover:opacity-100';
                        btn.innerText = '🔓';
                    } else {
                        // 고정 가능한 특성은 최대 3개로 제한
                        if (lockedTraitsList.length >= 3) {
                            showToast('특성은 최대 3개까지만 고정할 수 있습니다.');
                        } else {
                            // 잠금 설정
                            lockedTraitsList.push(tId);

                            // DOM만 즉시 변경 (전체 렌더링 X)
                            btn.className = 'absolute bottom-2 right-2 text-base z-10 p-1 hover:scale-110 transition-transform text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]';
                            btn.innerText = '🔒';
                        }
                    }
                    // updateCharacterUI() 호출을 제거하여 화면 번쩍임을 없앱니다.
                    return;
                }

                if (target.closest('#label-gender')) {
                    secretClickCount++;
                    if (secretClickCount === 10) {
                        state.adultMode = !state.adultMode;
                        secretClickCount = 0;
                        showToast(state.adultMode ? '🌙 비밀스러운 [성인 모드]가 활성화되었습니다.' : '☀️ [성인 모드]가 비활성화되었습니다.', state.adultMode);
                        if (!state.adultMode) state.player.traits = state.player.traits.filter(id => {
                            const tr = TRAITS[id];
                            return tr && !tr.reqAdult;
                        });
                        updateCharacterUI();
                    }
                }
                if (target.closest('#btn-reroll-traits') && state.player.originType !== 'possession') {
                    const btn = target.closest('#btn-reroll-traits');
                    btn.classList.add('rolling');
                    rollTraits();
                    updateCharacterUI();
                    setTimeout(() => btn.classList.remove('rolling'), 500);
                }
                if (target.closest('.gender-btn') && state.player.originType !== 'possession') {
                    const newGender = target.closest('.gender-btn').dataset.gender;
                    if (state.player.gender !== newGender) {
                        state.player.gender = newGender;
                        state.player.traits = state.player.traits.filter(id => {
                            const trait = TRAITS[id];
                            return !trait.reqGender || trait.reqGender === newGender;
                        });
                        const pStats = generatePhysicalAndHiddenStats(state.player.race, state.player.gender);
                        state.player.age = pStats.age;
                        state.player.height = pStats.height;
                        state.player.weight = pStats.weight;
                        state.player.hiddenStats = pStats.hidden;
                        ImagePreloader.preloadCurrentSet(state.player.race, state.player.gender); // 💡 추가
                        updateCharacterUI();
                    }
                }
                if (target.closest('.select-card[data-type="race"]') && !target.closest('.select-card.locked')) {
                    const newRace = target.closest('.select-card').dataset.id;
                    if (state.player.race !== newRace) {
                        state.player.race = newRace;
                        state.player.baseStats = {
                            ...RACES[state.player.race].baseStats
                        };
                        const pStats = generatePhysicalAndHiddenStats(state.player.race, state.player.gender);
                        state.player.age = pStats.age;
                        state.player.height = pStats.height;
                        state.player.weight = pStats.weight;
                        state.player.hiddenStats = pStats.hidden;
                        ImagePreloader.preloadCurrentSet(state.player.race, state.player.gender); // 💡 추가
                        updateCharacterUI();
                    }
                }
                const statBtn = target.closest('.stat-btn');
                if (statBtn && !statBtn.disabled) {
                    const action = statBtn.dataset.action;
                    const statKey = statBtn.dataset.stat;
                    const {
                        pointsLeft
                    } = calculateCurrentState();
                    if (action === 'increase-stat' && pointsLeft > 0) state.player.addedStats[statKey]++;
                    else if (action === 'decrease-stat' && state.player.addedStats[statKey] > 0) state.player.addedStats[statKey]--;
                    updateCharacterUI();
                }

                if (target.closest('#btn-start-journey')) {
                    if (state.player.originType === 'possession') {
                        const targetSel = document.getElementById('sel-possession-target');
                        if (!targetSel || !targetSel.value) {
                            alert("빙의할 대상을 반드시 선택해야 합니다!");
                            return;
                        }
                        const targetNpc = state.npcs.find(n => n.id === targetSel.value);
                        if (targetNpc && targetNpc.location) {
                            state.player.location = {
                                x: targetNpc.location.x,
                                y: targetNpc.location.y
                            };
                        }
                    }

                    if (state.player.originType !== 'possession') {
                        const fName = document.getElementById('player-first-name').value.trim();
                        const lName = document.getElementById('player-last-name').value.trim();

                        state.player.firstName = fName;
                        state.player.lastName = lName ? " " + lName : "";
                        state.player.name = fName + state.player.lastName;

                        let ageInput = parseInt(document.getElementById('player-age').value.trim()) || 18;
                        const maxAgeNode = document.getElementById('player-age');
                        if (maxAgeNode && maxAgeNode.max) {
                            const maxAge = parseInt(maxAgeNode.max);
                            if (ageInput > maxAge) ageInput = maxAge;
                        }

                        state.player.age = ageInput;
                        state.player.height = document.getElementById('player-height').value.trim();
                        state.player.weight = document.getElementById('player-weight').value.trim();
                    }

                    const {
                        finalStats,
                        finalGold
                    } = calculateCurrentState();
                    state.player.finalStats = finalStats;
                    state.player.gold = finalGold;
                    if (state.player.originType === 'regression') state.gameDate.year = parseInt(document.getElementById('sel-regression-year').value);

                    if (state.player.originType === 'npc_child' && state.player.parents && state.player.parents.mother.location) {
                        state.player.location = {
                            x: state.player.parents.mother.location.x,
                            y: state.player.parents.mother.location.y
                        };
                    }

                    if (!state.player.location) {
                        let validTiles = [];
                        state.worldMap.forEach(row => {
                            row.forEach(t => {
                                if (t.type === 'grass' || t.type === 'forest') validTiles.push(t);
                            });
                        });
                        if (validTiles.length === 0) validTiles = [state.worldMap[Math.floor(MAP_SIZE / 2)][Math.floor(MAP_SIZE / 2)]];
                        const startTile = validTiles[Math.floor(Math.random() * validTiles.length)];
                        state.player.location = {
                            x: startTile.x,
                            y: startTile.y
                        };
                    }

                    if (state.player.gender === 'F') {
                        const hasGarter = state.player.equipment.left_thigh === 'garter_belt' || state.player.equipment.right_thigh === 'garter_belt' || state.player.baseInventory.items.some(i => i.id === 'garter_belt');
                        if (!hasGarter) {
                            state.player.equipment.left_thigh = 'garter_belt';
                            state.player.leftThighInventory = {
                                w: 2,
                                h: 3,
                                items: [{
                                    id: 'dagger_basic',
                                    x: 0,
                                    y: 0,
                                    durability: 80
                                }]
                            };
                            state.player.baseInventory.items = state.player.baseInventory.items.filter(i => i.id !== 'garter_belt' && i.id !== 'dagger_basic');
                        }
                    } else {
                        state.player.baseInventory.items = state.player.baseInventory.items.filter(i => i.id !== 'garter_belt' && i.id !== 'dagger_basic');
                    }

                    // 💡 [새로 추가된 로직] 부모-자식 간 천륜(초기 호감도) 형성
                    if (state.player.originType === 'npc_child' && state.player.parents) {
                        let mother = state.npcs.find(n => n.id === state.player.parents.mother.id);
                        let father = state.npcs.find(n => n.id === state.player.parents.father.id);

                        // 혈연 관계이므로 기본 호감도를 80~100 사이로 높게 설정
                        if (mother) addFavorability(state.player, mother, 80 + Math.floor(Math.random() * 21));
                        if (father) addFavorability(state.player, father, 80 + Math.floor(Math.random() * 21));
                    }
                    // 환생자가 귀족/특정 가문을 선택하고 태어난 경우
                    else if (state.player.originType === 'isekai') {
                        let sel = document.getElementById('sel-reincarnation-parent');
                        if (sel && sel.value) {
                            let parentNpc = state.npcs.find(n => n.id === sel.value);
                            if (parentNpc) {
                                // 입양/환생이더라도 한 지붕 아래 컸으므로 호감도를 높게 설정
                                addFavorability(state.player, parentNpc, 70 + Math.floor(Math.random() * 21));
                                // UI 렌더링 호환성을 위해 부모 데이터 세팅
                                state.player.parents = {
                                    father: parentNpc,
                                    mother: parentNpc
                                };
                            }
                        }
                    }

                    state.screen = 'world';
                    state.inGameTab = 'city';
                    render();

                }
            }

            if (state.screen === 'world') {
                if (target.closest('#btn-close-tile-modal')) {
                    const modal = document.getElementById('tile-info-modal');
                    if (modal) {
                        modal.classList.add('-translate-x-full', 'opacity-0', 'pointer-events-none');
                        modal.classList.remove('translate-x-0', 'opacity-100', 'pointer-events-auto');
                    }
                }
            }
        });
        // ==========================================
        // 💡 던전 파티 진형: 드래그 앤 드롭 이벤트
        // ==========================================
        appEl.addEventListener('dragstart', (e) => {
            if (e.target.closest('[draggable="true"]')) {
                const dropZone = e.target.closest('.drop-zone');
                if (dropZone) {
                    // 어느 칸(인덱스)에서 드래그를 시작했는지 기억합니다.
                    e.dataTransfer.setData('text/plain', dropZone.dataset.slotIndex);
                }
            }
        });

        appEl.addEventListener('dragover', (e) => {
            const dropZone = e.target.closest('.drop-zone');
            if (dropZone) {
                e.preventDefault(); // 드롭을 허용하기 위해 필수
                // 마우스가 올라간 칸에 시각적 효과 주기 (선택사항)
                dropZone.classList.add('bg-slate-800');
            }
        });

        appEl.addEventListener('dragleave', (e) => {
            const dropZone = e.target.closest('.drop-zone');
            if (dropZone) {
                dropZone.classList.remove('bg-slate-800');
            }
        });

        appEl.addEventListener('drop', (e) => {
            const dropZone = e.target.closest('.drop-zone');
            if (dropZone) {
                e.preventDefault();
                dropZone.classList.remove('bg-slate-800');

                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = parseInt(dropZone.dataset.slotIndex);

                if (!isNaN(fromIndex) && !isNaN(toIndex) && fromIndex !== toIndex) {
                    if (state.dungeonRun && state.dungeonRun.formation) {
                        // 1. 데이터 스왑 (위치 변경)
                        const temp = state.dungeonRun.formation[toIndex];
                        state.dungeonRun.formation[toIndex] = state.dungeonRun.formation[fromIndex];
                        state.dungeonRun.formation[fromIndex] = temp;

                        // 2. 전체 화면 렌더링(renderDungeonExplore) 대신, 그리드 부분만 다시 그리기 (깜빡임 방지)
                        const gridEl = document.getElementById('formation-grid');
                        if (gridEl) {
                            let newSlotsHtml = '';
                            for (let i = 0; i < 9; i++) {
                                let isPlayer = (state.dungeonRun.formation[i] === 'player');
                                let colIndex = i % 3;
                                let positionText = colIndex === 0 ? '후열' : (colIndex === 1 ? '중열' : '전열');

                                newSlotsHtml += `
                            <div class="h-24 bg-slate-900 border border-slate-600 border-dashed hover:border-blue-400 rounded-lg flex flex-col items-center justify-center transition-colors relative drop-zone" data-slot-index="${i}">
                                <div class="absolute top-1 left-1 text-[10px] font-bold text-slate-500">${positionText}</div>
                                ${isPlayer ? `
                                <div class="w-full h-full flex flex-col items-center justify-center cursor-grab active:cursor-grabbing hover:bg-indigo-900/30 rounded-lg border-2 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)] transition-all" draggable="true">
                                    <span class="text-2xl mb-1 drop-shadow-md">👤</span>
                                    <span class="text-sm font-bold text-indigo-300">${state.player.name}</span>
                                </div>
                                ` : `<span class="text-xl text-slate-600 opacity-50">+</span>`}
                            </div>
                        `;
                            }
                            // 변경된 부분만 쏙 집어넣기
                            gridEl.innerHTML = newSlotsHtml;
                        }
                    }
                }
            }
        });

        // PC 로컬 파일로 세이브 데이터 불러오기 핸들러
        function handleLocalSaveFile(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const loadedState = JSON.parse(event.target.result);
                    if (loadedState.player && loadedState.worldMap) {
                        state = loadedState;
                        showToast("PC 세이브 파일을 성공적으로 불러왔습니다.");

                        document.getElementById('system-modal')?.classList.add('hidden');
                        document.getElementById('system-modal')?.classList.remove('flex');
                        document.getElementById('load-modal')?.classList.add('hidden');
                        document.getElementById('load-modal')?.classList.remove('flex');

                        if (state.screen === 'world') {
                            renderInGameLayout();
                            centerMapOnPlayer();
                        } else {
                            render();
                        }
                    } else {
                        alert("올바른 에테리아 연대기 세이브 파일이 아닙니다.");
                    }
                } catch (err) {
                    alert("세이브 파일 파싱 실패: 파일이 손상되었습니다.");
                }
            };
            reader.readAsText(file);
            e.target.value = ''; // 같은 파일을 다시 선택할 수 있도록 초기화
        }

        document.getElementById('input-mod-file')?.addEventListener('change', handleLocalFileMod);

        // 이벤트 위임(change) 통합 핸들링
        appEl.addEventListener('change', (e) => {
            if (e.target.id === 'input-mod-file') {
                handleLocalFileMod(e);
                return;
            }
            if (e.target.id === 'input-save-file' || e.target.id === 'input-save-file-system') {
                handleLocalSaveFile(e);
                return;
            }
            if (e.target.classList.contains('filter-select')) {
                const filterName = e.target.dataset.filter;
                debugState[filterName] = e.target.value;
                renderDebugModalContent();
                return;
            }
            if (state.screen === 'create') {
                // 💡 수정할 부분: 빙의(possession) 선택 시 대상의 초상화 ID도 가져오기
                if (e.target.id === 'sel-possession-target') {
                    const targetId = e.target.value;
                    const targetNpc = state.npcs.find(n => n.id === targetId);
                    if (targetNpc) {
                        state.player.name = targetNpc.name;
                        state.player.gender = targetNpc.gender;
                        state.player.race = targetNpc.race;
                        state.player.age = targetNpc.age;
                        state.player.height = targetNpc.height;
                        state.player.weight = targetNpc.weight;
                        state.player.baseStats = JSON.parse(JSON.stringify(targetNpc.baseStats));
                        state.player.hiddenStats = JSON.parse(JSON.stringify(targetNpc.hiddenStats));
                        state.player.traits = [...targetNpc.traits.filter(t => t !== 'possessor'), 'possessor'];
                        state.player.addedStats = {
                            str: 0,
                            mag: 0,
                            agi: 0,
                            cha: 0
                        };
                        state.player.portraitId = targetNpc.portraitId || 1;
                        updateCharacterUI();
                    }
                }
                if (e.target.id === 'sel-reincarnation-parent') {
                    const targetId = e.target.value;
                    if (targetId) {
                        const targetNpc = state.npcs.find(n => n.id === targetId);
                        if (targetNpc) {
                            state.player.race = targetNpc.race;
                            state.player.baseStats = {
                                ...RACES[targetNpc.race].baseStats
                            };
                            updateCharacterUI();
                        }
                    } else {
                        updateCharacterUI();
                    }
                }
            }
            if (state.screen === 'world') {
                if (e.target.classList.contains('layer-toggle')) {
                    state.mapLayers[e.target.dataset.layer] = e.target.checked;
                    drawCanvasMap(false);
                }
            }
        });

        appEl.addEventListener('input', (e) => {
            if (state.screen === 'create') {
                if (e.target.id === 'player-first-name' || e.target.id === 'player-last-name') {
                    // 키보드 입력 시 실시간으로 서사 문구 업데이트
                    updateCharacterUI();
                } else if (e.target.id === 'player-age') state.player.age = e.target.value;
                // ... (나머지 로직 동일) ...
                else if (e.target.id === 'player-height') state.player.height = e.target.value;
                else if (e.target.id === 'player-weight') state.player.weight = e.target.value;
                else if (e.target.id === 'sel-regression-year') {
                    state.player.regressionYear = e.target.value;
                    const valEl = document.getElementById('ui-regression-val');
                    if (valEl) valEl.innerText = `${state.player.regressionYear}년`;
                }
            }
        });
        // ==========================================
        // 스탯 버튼 연속 클릭 (꾹 누르기) 기능
        // ==========================================
        let statPressTimer = null;
        let statPressInterval = null;

        function clearStatPress() {
            if (statPressTimer) clearTimeout(statPressTimer);
            if (statPressInterval) clearInterval(statPressInterval);
            statPressTimer = null;
            statPressInterval = null;
        }

        // 마우스 및 모바일 터치(pointerdown) 모두 대응
        document.addEventListener('pointerdown', (e) => {
            const btn = e.target.closest('.stat-btn');
            if (!btn || btn.disabled) return;

            const action = btn.dataset.action;
            if (action !== 'increase-stat' && action !== 'decrease-stat') return;

            clearStatPress();

            // 0.4초(400ms) 이상 꾹 누르고 있으면 연속 클릭 모드 돌입
            statPressTimer = setTimeout(() => {
                statPressInterval = setInterval(() => {
                    // 스탯 포인트가 바닥나거나 최대치에 도달해 버튼이 비활성화되면 자동 정지
                    if (btn.disabled) {
                        clearStatPress();
                        return;
                    }
                    btn.click(); // 코드가 직접 버튼을 다다닥 눌러줍니다.
                }, 60); // 0.06초(60ms) 마다 1씩 빠르게 증감
            }, 400);
        });

        // 손을 떼거나 마우스가 버튼 밖으로 나가면 즉시 멈춤
        document.addEventListener('pointerup', clearStatPress);
        document.addEventListener('pointerleave', clearStatPress);
        document.addEventListener('pointercancel', clearStatPress);
        window.drawCanvasMap = drawCanvasMap;
        window.showTileModal = showTileModal;

        render();

        // ==========================================
        // [디버그 모듈] 수동 던전 생성기 (테스트용)
        // ==========================================
        const DEBUG_DUNGEON_ENABLE = true; // 💡 나중에 숨기고 싶을 때는 이 값을 false로 바꾸거나 이 블록 전체를 삭제하세요.

        // 상태값 초기화 (기존 state에 안전하게 주입)
        if (typeof state.dungeons === 'undefined') state.dungeons = [];
        if (typeof state.counters.dungeon === 'undefined') state.counters.dungeon = 1;

        // 1. 던전 생성 이벤트 (Shift + 맵 좌클릭)
        document.addEventListener('click', (e) => {
            if (!DEBUG_DUNGEON_ENABLE) return;

            // 맵 캔버스를 클릭했고, Shift 키를 누르고 있을 때만 작동
            if ((e.target.id === 'player-canvas' || e.target.id === 'world-canvas') && e.shiftKey) {
                const rect = e.target.getBoundingClientRect();

                // 마우스 클릭 위치를 맵의 타일 좌표(X, Y)로 변환
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                const tileX = Math.floor(clickX / state.tileSize);
                const tileY = Math.floor(clickY / state.tileSize);

                // 맵 범위를 벗어나지 않았는지 확인
                if (tileX >= 0 && tileX < MAP_SIZE && tileY >= 0 && tileY < MAP_SIZE) {
                    const existingIdx = state.dungeons.findIndex(d => d.x === tileX && d.y === tileY);

                    if (existingIdx === -1) {
                        // 던전이 없으면 새로 생성
                        const newDungeon = {
                            id: 'dungeon_' + state.counters.dungeon++,
                            name: '미지의 디버그 던전',
                            x: tileX,
                            y: tileY,
                            type: 'ruins',
                            difficulty: Math.floor(Math.random() * 5) + 1, // 난이도 1~5
                        };
                        state.dungeons.push(newDungeon);
                        showToast(`[디버그] (${tileX}, ${tileY}) 위치에 던전 생성 완료!`);
                    } else {
                        // 이미 던전이 있으면 삭제 (토글 기능)
                        state.dungeons.splice(existingIdx, 1);
                        showToast(`[디버그] (${tileX}, ${tileY}) 위치의 던전이 삭제되었습니다.`);
                    }

                    // 화면 즉시 갱신
                    if (typeof drawPlayerOverlay === 'function') drawPlayerOverlay();
                }
            }
        });

        // 2. 던전 렌더링 (기존 맵 그리기 함수에 몰래 끼워넣기)
        // 기존 코드를 뜯어고치지 않고 덧칠하는 방식(Monkey Patch)이라 안전합니다.
        if (typeof window.originalDrawPlayerOverlay === 'undefined' && typeof drawPlayerOverlay !== 'undefined') {
            window.originalDrawPlayerOverlay = drawPlayerOverlay;

            drawPlayerOverlay = function() {
                // 기존 맵 오버레이(국경, 마나, 플레이어 등)를 먼저 그립니다.
                window.originalDrawPlayerOverlay();

                if (!DEBUG_DUNGEON_ENABLE || state.inGameTab !== 'map') return;

                const pCanvas = document.getElementById('player-canvas');
                if (!pCanvas) return;
                const pCtx = pCanvas.getContext('2d');
                const ts = state.tileSize;

                // 생성된 던전 배열을 순회하며 맵 위에 ☠️ 아이콘을 덧그립니다.
                state.dungeons.forEach(d => {
                    const px = d.x * ts;
                    const py = d.y * ts;

                    pCtx.font = `${ts * 0.8}px Arial`;
                    pCtx.textAlign = 'center';
                    pCtx.textBaseline = 'middle';

                    const cx = px + ts / 2;
                    const cy = py + ts / 2;
                    const iconSize = Math.max(14, ts * 1.35);
                    pCtx.font = `${ts * 0.8}px Arial`;
                    pCtx.textAlign = 'center';
                    pCtx.textBaseline = 'middle';
                    pCtx.shadowColor = 'rgba(0,0,0,0.9)';
                    pCtx.shadowBlur = 4;
                    pCtx.fillText('☠️', cx, cy);
                    pCtx.shadowBlur = 0;
                });
            };
        }
        // =======================================================================
        // [신규 시스템] 인스턴스 던전 & 플로팅 디버그 툴 (Drag & Drop)
        // =======================================================================

        // 💡 [배포 스위치] 이 값을 false로 바꾸면 게임에서 디버그 툴이 완전히 사라집니다.
        const ENABLE_DEBUG_TOOL = true;

        // 1. 던전 테마 및 몬스터 데이터 설정
        let DUNGEON_THEMES = {
            goblin_camp: {
                id: 'goblin_camp',
                name: '고블린 군막',
                icon: '⛺',
                desc: '더러운 천막과 조잡한 덫이 가득한 군막입니다.',
                monsters: ['고블린', '고블린 주술사']
            },
            troll_lair: {
                id: 'troll_lair',
                name: '트롤 서식지',
                icon: '🪨',
                desc: '악취가 진동하는 거대한 짐승들의 굴입니다.',
                monsters: ['동굴 트롤', '트롤 전사']
            },
            bee_hive: {
                id: 'bee_hive',
                name: '자이언트 비 하이브',
                icon: '🍯',
                desc: '거대한 꿀벌들이 벽을 파서 만든 끈적한 벌집 미로입니다.',
                monsters: ['거대 꿀벌', '여왕벌']
            },
            ancient_ruin: {
                id: 'ancient_ruin',
                name: '고대 유적',
                icon: '🏛️',
                desc: '과거의 영광이 잠든 채 언데드가 배회하는 곳입니다.',
                monsters: ['스켈레톤', '가고일']
            },
            abyss_crack: {
                id: 'abyss_crack',
                name: '심연의 틈새',
                icon: '🌌',
                desc: '마나가 과포화되어 공간이 일그러진 변이 구역입니다.',
                monsters: ['공허의 망령', '심연의 눈']
            }
        };

        if (!state.dungeons) state.dungeons = [];
        let floatDebugState = {
            activeTab: 'dungeon',
            npcRace: 'all',
            npcNation: 'all',
            logRange: '1'
        };


        // 3. 맵 특정 좌표에 던전 생성 함수
        function spawnDungeonAtSelection(themeId) {
            if (!state.selectedTileInfo) {
                showToast("맵에서 던전을 생성할 타일을 먼저 클릭해주세요.", true);
                return;
            }
            let {
                x,
                y
            } = state.selectedTileInfo;
            let tile = state.worldMap[y][x];

            if (tile.type === 'water' || tile.type === 'deep_water' || tile.type === 'lake') {
                showToast("물 위에는 던전을 생성할 수 없습니다.");
                return;
            }

            let theme = DUNGEON_THEMES[themeId];
            let dungeon = {
                id: 'dungeon_' + Date.now(),
                x: x,
                y: y,
                themeId: themeId,
                name: theme.name,
                icon: theme.icon,
                cleared: false
            };

            state.dungeons.push(dungeon);
            tile.dungeonId = dungeon.id;

            showToast(`[던전 생성] ${theme.name}이(가) 나타났습니다!`);
            if (typeof drawCanvasMap === 'function') drawCanvasMap(false); // 맵 갱신
        }

        // 4. 기존 맵 렌더링 함수 가로채기(Monkey Patch) -> 던전 아이콘 표시
        // 기존 코드를 수정하지 않고도 던전 아이콘을 화면에 렌더링합니다.
        if (typeof window.drawPlayerOverlay === 'function') {
            const originalDrawOverlay = window.drawPlayerOverlay;
            window.drawPlayerOverlay = function() {
                originalDrawOverlay(); // 기존 플레이어/NPC 오버레이 렌더링 유지

                const playerCanvas = document.getElementById('player-canvas');
                const wrapper = document.getElementById('map-wrapper');
                if (playerCanvas && wrapper && state.dungeons) {
                    const pCtx = playerCanvas.getContext('2d');
                    state.dungeons.forEach(d => {
                        if (!d.cleared) {
                            const px = (d.x * state.tileSize) - wrapper.scrollLeft;
                            const py = (d.y * state.tileSize) - wrapper.scrollTop;
                            if (px >= -state.tileSize && px <= wrapper.clientWidth && py >= -state.tileSize && py <= wrapper.clientHeight) {
                                pCtx.font = `${state.tileSize * 0.8}px Arial`;
                                // 던전 아이콘에 살짝 그림자 효과 부여
                                pCtx.shadowColor = "rgba(0,0,0,0.8)";
                                pCtx.shadowBlur = 4;
                                pCtx.fillText(d.icon, px + (state.tileSize * 0.1), py + (state.tileSize * 0.85));
                                pCtx.shadowBlur = 0; // 초기화
                            }
                        }
                    });
                }
            };
        }

        // 5. 플로팅 디버그 툴 생성 및 제어 (Drag & Minimize)
        function initFloatingDebug() {
            if (!ENABLE_DEBUG_TOOL) return;

            const container = document.createElement('div');
            container.id = 'floating-debug-tool';

            let isMinimized = true;

            const tabs = document.createElement('div');
            tabs.className = 'flex flex-wrap bg-slate-800 border-b border-slate-700 select-none';
            tabs.style.display = isMinimized ? 'none' : 'flex';
            tabs.innerHTML = `
                <button onclick="floatDebugState.activeTab='dungeon'; renderFloatingDebug()" class="flex-1 py-1 text-xs font-bold border-r border-slate-700 hover:bg-slate-700 text-rose-400">던전생성</button>
                <button onclick="floatDebugState.activeTab='world'; renderFloatingDebug()" class="flex-1 py-1 text-xs font-bold border-r border-slate-700 hover:bg-slate-700 text-emerald-400">세계통계</button>
                <button onclick="floatDebugState.activeTab='npcs'; renderFloatingDebug()" class="flex-1 py-1 text-xs font-bold border-r border-slate-700 hover:bg-slate-700 text-blue-400">NPC동향</button>
                <button onclick="floatDebugState.activeTab='logs'; renderFloatingDebug()" class="flex-1 py-1 text-xs font-bold hover:bg-slate-700 text-slate-300">사건일지</button>
            `;

            const content = document.createElement('div');
            content.id = 'floating-debug-content-body';
            content.className = 'flex flex-col h-96 transition-all bg-slate-900 custom-scroll';
            content.style.display = isMinimized ? 'none' : 'flex';

            const header = document.createElement('div');
            header.className = 'bg-slate-800 p-2 cursor-move flex justify-between items-center border-b border-slate-700 select-none gap-4';
            header.style.touchAction = 'none';

            const updateUIState = () => {
                container.className = `fixed top-4 right-4 bg-slate-900/95 border-2 border-slate-600 rounded-xl shadow-2xl z-[90] flex flex-col transition-all overflow-hidden backdrop-blur-sm ${isMinimized ? 'w-auto' : 'w-80'}`;

                header.innerHTML = `
                    <span class="text-amber-400 font-bold tracking-wider pointer-events-none ${isMinimized ? 'text-xs' : 'text-sm'}">
                        ${isMinimized ? '🛠️' : '🛠️ GOD MODE TOOL'}
                    </span>
                    <button id="btn-toggle-debug" class="text-slate-400 hover:text-white px-2 font-bold text-lg leading-none shrink-0" style="touch-action: manipulation;">
                        ${isMinimized ? '+' : '-'}
                    </button>
                `;

                ['mousedown', 'touchstart'].forEach(evt => {
                    const btn = document.getElementById('btn-toggle-debug');
                    if (btn) btn.addEventListener(evt, (e) => e.stopPropagation(), {
                        passive: true
                    });
                });

                const toggleBtn = document.getElementById('btn-toggle-debug');
                if (toggleBtn) {
                    toggleBtn.addEventListener('click', () => {
                        isMinimized = !isMinimized;
                        tabs.style.display = isMinimized ? 'none' : 'flex';
                        content.style.display = isMinimized ? 'none' : 'flex';
                        updateUIState();
                    });
                }
            };

            container.appendChild(header);
            container.appendChild(tabs);
            container.appendChild(content);
            document.body.appendChild(container);

            updateUIState();

            let isDragging = false,
                startX, startY, initialX, initialY;

            const onDragStart = (e) => {
                if (e.target.id === 'btn-toggle-debug') return;
                isDragging = true;
                let clientX = e.touches ? e.touches[0].clientX : e.clientX;
                let clientY = e.touches ? e.touches[0].clientY : e.clientY;
                startX = clientX;
                startY = clientY;

                let rect = container.getBoundingClientRect();
                initialX = rect.left;
                initialY = rect.top;

                // 💡 [버그 수정] right 속성을 'auto'로 풀기 전에, 현재 좌표(left, top)를 먼저 픽셀로 꽉 잡아줍니다.
                container.style.left = initialX + 'px';
                container.style.top = initialY + 'px';
                container.style.right = 'auto';

                container.style.transition = 'none';
            };

            const onDragMove = (e) => {
                if (!isDragging) return;
                if (e.touches && e.cancelable) e.preventDefault();
                let clientX = e.touches ? e.touches[0].clientX : e.clientX;
                let clientY = e.touches ? e.touches[0].clientY : e.clientY;
                container.style.left = (initialX + clientX - startX) + 'px';
                container.style.top = (initialY + clientY - startY) + 'px';
            };

            const onDragEnd = () => {
                if (isDragging) {
                    isDragging = false;
                    container.style.transition = '';
                }
            };

            header.addEventListener('mousedown', onDragStart);
            header.addEventListener('touchstart', onDragStart, {
                passive: true
            });

            document.addEventListener('mousemove', onDragMove, {
                passive: false
            });
            document.addEventListener('touchmove', onDragMove, {
                passive: false
            });

            document.addEventListener('mouseup', onDragEnd);
            document.addEventListener('touchend', onDragEnd);

            renderFloatingDebug();
        }

        // 6. 플로팅 디버그 탭 렌더링 (기존 모달 기능 통합)
        window.renderFloatingDebug = function() {
            const content = document.getElementById('floating-debug-content-body');
            if (!content) return;

            let html = '';

            if (floatDebugState.activeTab === 'dungeon') {
                let themeOpts = Object.keys(DUNGEON_THEMES).map(k => `<option value="${k}">${DUNGEON_THEMES[k].icon} ${DUNGEON_THEMES[k].name}</option>`).join('');
                html = `
                    <div class="p-4 text-sm animate-fade-in flex flex-col h-full">
                        <div class="mb-4 bg-slate-800 border border-slate-600 p-3 rounded-lg text-center">
                            <span class="text-slate-400 block mb-1">현재 선택된 타일 좌표</span>
                            <span class="text-amber-400 font-bold text-lg">${state.selectedTileInfo ? `X:${state.selectedTileInfo.x}, Y:${state.selectedTileInfo.y}` : '없음 (맵 클릭 요망)'}</span>
                        </div>
                        <label class="block text-slate-400 text-xs font-bold mb-2">어떤 테마의 던전을 소환할까요?</label>
                        <select id="debug-dungeon-theme" class="w-full bg-black border border-slate-600 rounded p-3 text-white mb-6 outline-none shadow-inner">${themeOpts}</select>
                        <button onclick="spawnDungeonAtSelection(document.getElementById('debug-dungeon-theme').value)" class="mt-auto w-full bg-rose-700 hover:bg-rose-600 text-white font-bold py-3 rounded shadow-lg transition-transform transform active:scale-95">
                            ⚔️ 이 위치에 던전 강제 생성
                        </button>
                        <div class="text-[10px] text-slate-500 mt-3 text-center leading-tight">※ 생성 즉시 던전이 배치됩니다.</div>
                    </div>
                `;
            } else if (floatDebugState.activeTab === 'world') {
                let totalMana = 0;
                let totalPop = state.settlements.reduce((sum, s) => sum + s.population, 0);
                for (let y = 0; y < MAP_SIZE; y++)
                    for (let x = 0; x < MAP_SIZE; x++) totalMana += state.worldMap[y][x].mana;
                let avgMana = (totalMana / (MAP_SIZE * MAP_SIZE)) * 100;

                html = `
                    <div class="p-4 space-y-4 text-sm animate-fade-in overflow-y-auto">
                        <div class="bg-slate-800 p-3 rounded border border-emerald-900/50">
                            <h4 class="text-emerald-400 font-bold mb-2 border-b border-slate-700 pb-1">✨ 대륙 마나 통계</h4>
                            <div class="text-xs text-slate-300 space-y-1">
                                <div class="flex justify-between"><span>전체 평균 농도:</span> <span class="text-white font-bold">${avgMana.toFixed(1)}%</span></div>
                                <div class="flex justify-between"><span>총 보유 마나량:</span> <span class="text-white font-bold">${Math.floor(totalMana).toLocaleString()}</span></div>
                            </div>
                        </div>
                        <div class="bg-slate-800 p-3 rounded border border-blue-900/50">
                            <h4 class="text-blue-400 font-bold mb-2 border-b border-slate-700 pb-1">🏛️ 문명 통계</h4>
                            <div class="text-xs text-slate-300 space-y-1">
                                <div class="flex justify-between"><span>전 세계 총 인구:</span> <span class="text-white font-bold">${totalPop.toLocaleString()}명</span></div>
                                <div class="flex justify-between"><span>형성된 도시/마을:</span> <span class="text-white font-bold">${state.settlements.length}개</span></div>
                                <div class="flex justify-between"><span>발견된 던전 수:</span> <span class="text-rose-400 font-bold">${state.dungeons.length}개</span></div>
                            </div>
                        </div>
                    </div>
                `;
            } else if (floatDebugState.activeTab === 'logs') {
                let logsToRender = state.turnLogs || [];
                if (floatDebugState.logRange !== 'all') logsToRender = logsToRender.slice(0, parseInt(floatDebugState.logRange));
                let logsHtml = logsToRender.length > 0 ? logsToRender.map(lb => `<div class="mb-3"><div class="text-amber-400 font-bold text-xs mb-1">${lb.title}</div>${lb.logs.map(l=>`<div class="text-[11px] text-slate-300 mb-0.5">${l}</div>`).join('')}</div>`).join('') : '<div class="text-slate-500 text-xs text-center py-4">기록 없음</div>';
                let logOpts = `<option value="1" ${floatDebugState.logRange==='1'?'selected':''}>최근 1턴</option><option value="5" ${floatDebugState.logRange==='5'?'selected':''}>최근 5턴</option><option value="all" ${floatDebugState.logRange==='all'?'selected':''}>모두</option>`;
                html = `<div class="flex flex-col h-full animate-fade-in p-2"><select class="bg-black text-white border border-slate-600 rounded px-2 py-1 text-xs mb-2 outline-none" onchange="floatDebugState.logRange=this.value; renderFloatingDebug()">${logOpts}</select><div class="flex-1 overflow-y-auto p-1">${logsHtml}</div></div>`;
            } else if (floatDebugState.activeTab === 'npcs') {
                let filteredNPCs = state.npcs.filter(npc => (floatDebugState.npcRace === 'all' || npc.race === floatDebugState.npcRace));
                let npcsHtml = filteredNPCs.map(npc => `<div class="bg-slate-800 p-2 mb-1.5 rounded border border-slate-700 text-[11px] hover:border-blue-500 cursor-pointer clickable-npc" data-npc-id="${npc.id}"><div class="flex justify-between mb-1"><span class="font-bold text-white">${npc.name}</span><span class="text-yellow-400">${npc.gold}G</span></div><div class="text-slate-400">위치: ${npc.location?`X:${npc.location.x}, Y:${npc.location.y}`:'불명'}</div></div>`).join('');
                let raceOpts = `<option value="all">모든 종족</option>` + Object.keys(RACES).map(k => `<option value="${k}" ${floatDebugState.npcRace===k?'selected':''}>${RACES[k].name}</option>`).join('');
                html = `<div class="flex flex-col h-full animate-fade-in p-2"><select class="bg-black text-white border border-slate-600 rounded px-2 py-1 text-xs mb-2 outline-none" onchange="floatDebugState.npcRace=this.value; renderFloatingDebug()">${raceOpts}</select><div class="flex-1 overflow-y-auto p-1">${npcsHtml}</div></div>`;
            }
            content.innerHTML = html;
        };

        // 기존 디버그 모달 호출 함수를 덮어씌워, 호출 시 플로팅 툴을 열도록 유도
        window.renderDebugModalContent = function() {
            const floatTool = document.getElementById('floating-debug-tool');
            if (floatTool) {
                floatTool.style.display = 'flex';
                const modal = document.getElementById('debug-modal');
                if (modal) modal.classList.add('hidden'); // 기존 모달창이 뜨면 강제 숨김
                renderFloatingDebug();
            }
        }; // ==========================================
        // 💡 던전 전투 시스템 (스타레일식 행동 게이지 & 3x3 진형)
        // ==========================================
function startDungeonCombat() {
    const run = state.dungeonRun;
    
    let allies = [];
    let playerSpd = state.player.finalStats.agi || 50; 
    let playerPos = run.formation ? run.formation.indexOf('player') : 5; 
    
    allies.push({
        id: 'player',
        name: state.player.name,
        hp: 100, 
        maxHp: 100,
        spd: playerSpd,
        av: 10000 / playerSpd,
        isAlly: true,
        icon: '👤',
        position: playerPos
    });

    let enemies = [];
    let monsterName = run.theme.monsters[0] || '몬스터';
    let enemyCount = Math.floor(Math.random() * 3) + 1;
    let usedPositions = new Set();
    
    for(let i=0; i<enemyCount; i++) {
        let mSpd = 40 + Math.floor(Math.random() * 30); 
        let pos;
        do { pos = Math.floor(Math.random() * 9); } while(usedPositions.has(pos));
        usedPositions.add(pos);
        
        enemies.push({
            id: 'enemy_' + i,
            name: `${monsterName} ${String.fromCharCode(65+i)}`,
            hp: 50,
            maxHp: 50,
            spd: mSpd,
            av: 10000 / mSpd,
            isAlly: false,
            icon: '👹',
            position: pos
        });
    }

    let queue = [...allies, ...enemies];
    queue.sort((a, b) => a.av - b.av);

    state.combatState = {
        allies,
        enemies,
        queue,
        playerAction: 'select_action', // 💡 플레이어의 행동(공격, 스킬, 이동) 상태 추가
        log: "적과 조우했습니다! 전투가 시작됩니다."
    };

    state.screen = 'dungeon_combat';
    render();
    
    checkAutoCombatTurn(); 
}

function endCombatTurn() {
    let cState = state.combatState;
    
    let aliveAllies = cState.allies.filter(a => a.hp > 0);
    if(cState.enemies.length === 0) {
        showToast("전투 승리!");
        state.screen = 'dungeon_explore';
        state.dungeonRun.isResolving = false;
        generateDungeonCards(); 
        render();
        return;
    }
    if(aliveAllies.length === 0) {
        alert("전투 패배... 목숨을 잃었습니다.");
        state.screen = 'world';
        render();
        return;
    }

    let actor = cState.queue[0];
    actor.av += (10000 / actor.spd); // 행동 후 자신의 속도만큼 AV 증가 (턴 밀림)

    // 상태 초기화 및 대기열 재정렬
    cState.playerAction = 'select_action'; 
    cState.queue.sort((a, b) => a.av - b.av);
    
    renderDungeonCombat();
    checkAutoCombatTurn();
}

        function checkAutoCombatTurn() {
            let cState = state.combatState;
            if (!cState || cState.queue.length === 0) return;

            let currentActor = cState.queue[0];
            if (!currentActor.isAlly) {
                // 적 턴일 경우 1초 뒤 자동 공격 실행
                setTimeout(() => {
                    let aliveAllies = cState.allies.filter(a => a.hp > 0);
                    if (aliveAllies.length > 0) {
                        // 임시: 살아있는 아군 중 무작위 1명 공격
                        let target = aliveAllies[Math.floor(Math.random() * aliveAllies.length)];
                        let dmg = 10 + Math.floor(Math.random() * 5);
                        target.hp -= dmg;
                        cState.log = `<span class="text-rose-400">[${currentActor.name}]</span>의 공격! <span class="text-blue-300">[${target.name}]</span>에게 ${dmg} 피해!`;
                    }
                    endCombatTurn();
                }, 1000);
            }
        }


function renderDungeonCombat() {
    let cState = state.combatState;
    if (!cState) return;
    let currentActor = cState.queue[0];
    let currentGlobalAv = currentActor.av;

    let queueHtml = cState.queue.map((c, idx) => {
        let remainAv = Math.max(0, Math.floor(c.av - currentGlobalAv)); 
        return `
        <div class="flex items-center gap-3 bg-slate-800 border ${c.isAlly ? 'border-blue-500/50' : 'border-rose-500/50'} p-2 rounded mb-2 transition-all ${idx===0 ? 'scale-105 shadow-[0_0_10px_rgba(255,255,255,0.2)] border-white' : 'opacity-70'}">
            <div class="text-2xl drop-shadow-md">${c.icon}</div>
            <div class="flex-1 min-w-0">
                <div class="text-[11px] font-bold truncate ${c.isAlly ? 'text-blue-300' : 'text-rose-300'}">${c.name}</div>
                <div class="text-[10px] ${idx===0 ? 'text-emerald-400 font-bold' : 'text-slate-400'}">남은 행동수치: ${remainAv}</div>
            </div>
        </div>
        `;
    }).join('');

    let allyGridHtml = '';
    for(let i=0; i<9; i++) {
        let ally = cState.allies.find(a => a.position === i);
        let canMoveHere = currentActor.isAlly && cState.playerAction === 'move' && !ally;
        
        allyGridHtml += `
            <div class="h-24 bg-slate-900/80 border ${ally ? 'border-blue-500 shadow-[inset_0_0_10px_rgba(59,130,246,0.2)]' : 'border-slate-700 border-dashed'} rounded-lg flex flex-col items-center justify-center relative transition-all ${canMoveHere ? 'hover:bg-emerald-900/50 cursor-pointer border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : ''}"
                ${canMoveHere ? `onclick="executePlayerMove(${i})"` : ''}>
                ${ally ? `
                    <div class="text-3xl mb-1 ${currentActor.id === ally.id ? 'animate-bounce' : ''}">${ally.icon}</div>
                    <div class="w-[80%] bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1"><div class="bg-green-500 h-full transition-all" style="width: ${(ally.hp/ally.maxHp)*100}%"></div></div>
                ` : ''}
                ${canMoveHere ? `<div class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-emerald-500/20 rounded-lg"><span class="text-2xl text-white">🏃</span></div>` : ''}
            </div>
        `;
    }

    let enemyGridHtml = '';
    for(let i=0; i<9; i++) {
        let enemy = cState.enemies.find(e => e.position === i);
        let isTurn = enemy && currentActor.id === enemy.id;
        let canBeTargeted = enemy && currentActor.isAlly && (cState.playerAction === 'attack' || cState.playerAction === 'skill');
        
        enemyGridHtml += `
            <div class="h-24 bg-slate-900/80 border ${enemy ? 'border-rose-500' : 'border-slate-700 border-dashed'} rounded-lg flex flex-col items-center justify-center relative transition-all ${isTurn ? 'shadow-[0_0_15px_rgba(225,29,72,0.5)]' : ''} ${canBeTargeted ? 'cursor-pointer hover:bg-rose-900/50 hover:shadow-[0_0_15px_rgba(225,29,72,0.8)]' : ''}"
                 ${canBeTargeted ? `onclick="executePlayerAttack('${enemy.id}')"` : ''}>
                ${enemy ? `
                    <div class="text-3xl mb-1 ${isTurn ? 'animate-bounce' : ''}">${enemy.icon}</div>
                    <div class="w-[80%] bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1"><div class="bg-rose-500 h-full transition-all" style="width: ${(enemy.hp/enemy.maxHp)*100}%"></div></div>
                ` : ''}
                ${canBeTargeted ? `<div class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-rose-500/20 rounded-lg"><span class="text-2xl">🎯</span></div>` : ''}
            </div>
        `;
    }

    let bottomControlsHtml = '';
    if (currentActor.isAlly) {
        if (cState.playerAction === 'select_action') {
            bottomControlsHtml = `
                <div class="flex gap-4 w-full justify-center">
                    <button onclick="setPlayerAction('attack')" class="px-6 py-3 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-lg border border-rose-500 shadow-lg transition-all">⚔️ 일반 공격</button>
                    <button onclick="setPlayerAction('skill')" class="px-6 py-3 bg-indigo-700 hover:bg-indigo-600 text-white font-bold rounded-lg border border-indigo-500 shadow-lg transition-all">✨ 스킬 사용</button>
                    <button onclick="setPlayerAction('move')" class="px-6 py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg border border-emerald-500 shadow-lg transition-all">🏃 위치 이동</button>
                </div>
            `;
        } else if (cState.playerAction === 'attack' || cState.playerAction === 'skill') {
            bottomControlsHtml = `
                <div class="text-rose-400 font-bold flex items-center animate-pulse"><span class="text-2xl mr-2">🎯</span> 타겟팅할 적을 선택하세요. <button onclick="setPlayerAction('select_action')" class="ml-6 px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors">취소</button></div>
            `;
        } else if (cState.playerAction === 'move') {
            bottomControlsHtml = `
                <div class="text-emerald-400 font-bold flex items-center animate-pulse"><span class="text-2xl mr-2">🏃</span> 이동할 빈 아군 진형을 선택하세요. <button onclick="setPlayerAction('select_action')" class="ml-6 px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors">취소</button></div>
            `;
        }
    } else {
        bottomControlsHtml = `<div class="text-slate-500 font-bold flex items-center"><span class="animate-spin mr-2">⏳</span> 적이 행동을 준비 중입니다...</div>`;
    }

    // 💡 변경된 핵심 부분: 껍데기가 있으면 속맹이만 업데이트
    let combatContainer = document.getElementById('combat-main-container');
    if (!combatContainer) {
        appEl.innerHTML = `
            <div id="combat-main-container" class="min-h-screen bg-[#0a0f18] flex flex-col p-4 md:p-8 animate-fade-in relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-full pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-900/10 via-[#0a0f18] to-black opacity-80"></div>
                <div class="z-10 w-full max-w-6xl mx-auto flex flex-col h-full">
                    <div id="combat-log" class="bg-slate-900/80 border border-slate-600 rounded-xl p-4 mb-6 text-center text-lg font-bold shadow-lg h-16 flex items-center justify-center backdrop-blur-sm transition-all">
                        ${cState.log}
                    </div>
                    <div class="flex flex-col md:flex-row flex-1 gap-6 min-h-0">
                        <div class="w-full md:w-48 bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex flex-col shadow-inner backdrop-blur-sm h-48 md:h-auto overflow-hidden shrink-0">
                            <div class="text-xs font-bold text-slate-400 mb-3 text-center tracking-widest border-b border-slate-700 pb-2">행동 대기열</div>
                            <div id="combat-queue" class="flex-1 overflow-y-auto custom-scroll pr-1">
                                ${queueHtml}
                            </div>
                        </div>
                        <div class="flex-1 flex flex-col">
                            <div class="flex-1 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
                                <div class="bg-blue-950/20 p-4 rounded-xl border border-blue-900/50 relative">
                                    <div class="absolute -top-6 w-full text-center text-blue-400 text-xs font-bold tracking-widest">아군 진형 (전열 ▶)</div>
                                    <div id="combat-ally-grid" class="grid grid-cols-3 gap-2 w-full md:w-80">
                                        ${allyGridHtml}
                                    </div>
                                </div>
                                <div class="text-4xl md:text-5xl font-black text-slate-700 italic font-fantasy drop-shadow-xl hidden md:block">VS</div>
                                <div class="bg-rose-950/20 p-4 rounded-xl border border-rose-900/50 relative">
                                    <div class="absolute -top-6 w-full text-center text-rose-400 text-xs font-bold tracking-widest">(◀ 전열) 적군 진형</div>
                                    <div id="combat-enemy-grid" class="grid grid-cols-3 gap-2 w-full md:w-80">
                                        ${enemyGridHtml}
                                    </div>
                                </div>
                            </div>
                            <div id="combat-controls" class="h-20 md:h-24 bg-slate-900/80 border border-slate-700 rounded-xl mt-6 flex items-center justify-center shadow-lg p-4 shrink-0 transition-all">
                                ${bottomControlsHtml}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // 이미 렌더링 된 상태라면 필요한 구역만 교체 (깜빡임 X)
        document.getElementById('combat-log').innerHTML = cState.log;
        document.getElementById('combat-queue').innerHTML = queueHtml;
        document.getElementById('combat-ally-grid').innerHTML = allyGridHtml;
        document.getElementById('combat-enemy-grid').innerHTML = enemyGridHtml;
        document.getElementById('combat-controls').innerHTML = bottomControlsHtml;
    }
}
