
        // ==========================================
        // 0-1. 세이브/로드 매니저 (IndexedDB 기반)
        // ==========================================
        const AetheriaSaveManager = {
            dbName: 'AetheriaChroniclesDB',
            storeName: 'saves',
            db: null,

            init() {
                return new Promise((resolve, reject) => {
                    if (this.db) return resolve(this.db);
                    const req = indexedDB.open(this.dbName, 1);
                    req.onupgradeneeded = (e) => {
                        let db = e.target.result;
                        if (!db.objectStoreNames.contains(this.storeName)) {
                            db.createObjectStore(this.storeName, {
                                keyPath: 'slotId'
                            });
                        }
                    };
                    req.onsuccess = (e) => {
                        this.db = e.target.result;
                        resolve(this.db);
                    };
                    req.onerror = (e) => reject(e.target.error);
                });
            },

            async saveGame(slotId) {
                await this.init();
                return new Promise((resolve, reject) => {
                    const tx = this.db.transaction(this.storeName, 'readwrite');
                    const store = tx.objectStore(this.storeName);

                    const saveInfo = {
                        slotId: slotId,
                        timestamp: Date.now(),
                        summary: `${state.player.name} (${RACES[state.player.race] ? RACES[state.player.race].name : '알수없음'})`,
                        dateInfo: `${state.gameDate.year}년 ${state.gameDate.month}월 ${state.gameDate.week}주차`,
                        gold: state.player.gold,
                        stateData: JSON.parse(JSON.stringify(state)) // 깊은 복사로 상태 저장
                    };

                    const req = store.put(saveInfo);
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => reject(req.error);
                });
            },

            async loadGame(slotId) {
                await this.init();
                return new Promise((resolve, reject) => {
                    const tx = this.db.transaction(this.storeName, 'readonly');
                    const store = tx.objectStore(this.storeName);
                    const req = store.get(slotId);

                    req.onsuccess = (e) => {
                        if (req.result) resolve(req.result.stateData);
                        else resolve(null);
                    };
                    req.onerror = () => reject(req.error);
                });
            },

            async getSaveList() {
                await this.init();
                return new Promise((resolve, reject) => {
                    const tx = this.db.transaction(this.storeName, 'readonly');
                    const store = tx.objectStore(this.storeName);
                    const req = store.getAll();

                    req.onsuccess = (e) => {
                        // stateData는 제외하고 메타데이터만 반환하여 속도 최적화
                        const list = req.result.map(item => ({
                            slotId: item.slotId,
                            timestamp: item.timestamp,
                            summary: item.summary,
                            dateInfo: item.dateInfo,
                            gold: item.gold
                        }));
                        resolve(list);
                    };
                    req.onerror = () => reject(req.error);
                });
            }
        };

        // ==========================================
        // 0-2. 이미지 프리로딩 매니저
        // ==========================================
        const ImagePreloader = {
            cache: new Set(),
            preloadPortrait(race, gender, id) {
                const baseUrl = "assets";
                const genderDir = (gender || "").toLowerCase();
                const imgUrl = `${baseUrl}/${race}/${genderDir}/${id}/face.png`;
                if (this.cache.has(imgUrl)) return;

                const img = new Image();
                img.src = imgUrl;
                img.onload = () => this.cache.add(imgUrl);
            },
            // 현재 종족/성별의 모든 초상화(1~30)를 미리 로드
            preloadCurrentSet(race, gender) {
                for (let i = 1; i <= 30; i++) {
                    this.preloadPortrait(race, gender, i);
                }
            }
        };

        // (아이콘 스프라이트 사용 안 함)

        // ==========================================
        // 0. 드래그 앤 드롭 전역 함수 등록
        // ==========================================
        let dragData = null;
        let autoScrollInterval = null;
        let autoScrollSpeed = 0;

        window.handleDragStart = function(e, data) {
            isDraggingItem = true;
            dragData = data;
            e.dataTransfer.setData('text/plain', JSON.stringify(data));
            e.dataTransfer.effectAllowed = 'move';
        };

        window.handleDragEnd = function(e) {
            dragData = null;
            setTimeout(() => {
                isDraggingItem = false;
            }, 50); // 드롭 직후 클릭되는 현상 방지
            if (autoScrollInterval) {
                clearInterval(autoScrollInterval);
                autoScrollInterval = null;
            }
        };

        window.handleDragOver = function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        };

        // 전역 드래그 오버 시 스크롤 처리
        window.addEventListener('dragover', function(e) {
            if (!dragData) return;
            const container = document.getElementById('ui-overlay-container');
            if (!container || container.classList.contains('hidden')) return;

            const threshold = 100; // 가장자리 인식 거리 (px)
            const rect = container.getBoundingClientRect();

            autoScrollSpeed = 0;
            if (e.clientY < rect.top + threshold) {
                autoScrollSpeed = -15; // 위로 스크롤
            } else if (e.clientY > rect.bottom - threshold) {
                autoScrollSpeed = 15; // 아래로 스크롤
            }

            if (autoScrollSpeed !== 0) {
                if (!autoScrollInterval) {
                    autoScrollInterval = setInterval(() => {
                        if (container) container.scrollTop += autoScrollSpeed;
                    }, 20);
                }
            } else {
                if (autoScrollInterval) {
                    clearInterval(autoScrollInterval);
                    autoScrollInterval = null;
                }
            }
        });

        window.addEventListener('drop', function(e) {
            if (autoScrollInterval) {
                clearInterval(autoScrollInterval);
                autoScrollInterval = null;
            }
        });

        window.handleDropOnEquipSlot = function(e, slotKey) {
            e.preventDefault();
            if (!dragData) return;

            const itemId = dragData.item.id;
            const itemDef = ITEMS[itemId];

            let canEquip = false;
            if (slotKey === 'left_hand' || slotKey === 'right_hand') {
                canEquip = itemDef.type === 'hand';
            } else if (slotKey === 'left_thigh' || slotKey === 'right_thigh') {
                canEquip = itemDef.type === 'thigh';
            } else {
                canEquip = itemDef.type === slotKey;
            }

            if (!canEquip) {
                showToast("이 슬롯에 장착할 수 없는 아이템입니다.");
                return;
            }

            if (state.player.equipment[slotKey]) {
                showToast("이미 장비가 장착되어 있습니다. 빈 공간에 드롭하여 해제하세요.");
                return;
            }

            if (dragData.source === 'equipment') {
                state.player.equipment[dragData.slotKey] = null;
            } else {
                const inv = state.player[dragData.source];
                inv.items.splice(dragData.invIndex, 1);
            }

            state.player.equipment[slotKey] = itemId;
            updateInGameOverlay(false);
        };

        window.handleDropOnInventory = function(e, targetInvName) {
            e.preventDefault();
            if (!dragData) return;

            const itemId = dragData.item.id;
            const itemDef = ITEMS[itemId];
            const targetInv = state.player[targetInvName];

            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const cSize = 56; // 셀 픽셀 사이즈
            const targetX = Math.floor(x / cSize);
            const targetY = Math.floor(y / cSize);

            if (targetX < 0 || targetY < 0 || targetX + itemDef.w > targetInv.w || targetY + itemDef.h > targetInv.h) {
                showToast("인벤토리 공간을 벗어났습니다.");
                return;
            }

            let isCollision = false;
            for (let i = 0; i < targetInv.items.length; i++) {
                if (dragData.source === targetInvName && i === dragData.invIndex) continue;
                const existingItem = targetInv.items[i];
                const exDef = ITEMS[existingItem.id];
                if (
                    targetX < existingItem.x + exDef.w &&
                    targetX + itemDef.w > existingItem.x &&
                    targetY < existingItem.y + exDef.h &&
                    targetY + itemDef.h > existingItem.y
                ) {
                    isCollision = true;
                    break;
                }
            }

            if (isCollision) {
                showToast("다른 아이템과 겹칩니다.");
                return;
            }

            let durCur = itemDef.maxDurability;
            if (dragData.source === 'equipment') {
                state.player.equipment[dragData.slotKey] = null;
            } else {
                const srcInv = state.player[dragData.source];
                durCur = srcInv.items[dragData.invIndex].durability;
                srcInv.items.splice(dragData.invIndex, 1);
            }

            targetInv.items.push({
                id: itemId,
                x: targetX,
                y: targetY,
                durability: durCur
            });
            updateInGameOverlay(false);
        };

