        // ==========================================
        // 1-1. 모드 관리 및 데이터 로드 (클라우드/로컬)
        // ==========================================
        function exportDefaultData() {
            const data = {
                RACES,
                TRAITS,
                BUILDINGS,
                MAP_RESOURCES,
                NATION_TEMPLATES,
                AMBITIONS,
                SETTLEMENT_TIERS,
                NAME_DATA,
                SETTLEMENT_NAME_DATA
            };
            const blob = new Blob([JSON.stringify(data, null, 4)], {
                type: "application/json"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "aetheria_mod_template.json";
            a.click();
            URL.revokeObjectURL(url);
            showToast("기본 데이터 템플릿이 다운로드되었습니다.");
        }

        function applyModData(data) {
            try {
                if (data.RACES) RACES = data.RACES;
                if (data.TRAITS) TRAITS = data.TRAITS;
                if (data.BUILDINGS) BUILDINGS = data.BUILDINGS;
                if (data.MAP_RESOURCES) MAP_RESOURCES = data.MAP_RESOURCES;
                if (data.NATION_TEMPLATES) NATION_TEMPLATES = data.NATION_TEMPLATES;
                if (data.AMBITIONS) AMBITIONS = data.AMBITIONS;
                if (data.SETTLEMENT_TIERS) SETTLEMENT_TIERS = data.SETTLEMENT_TIERS;
                if (data.NAME_DATA) NAME_DATA = data.NAME_DATA;
                if (data.SETTLEMENT_NAME_DATA) SETTLEMENT_NAME_DATA = data.SETTLEMENT_NAME_DATA;
                showToast("✅ 모드/데이터가 성공적으로 적용되었습니다!");
                setTimeout(() => {
                    state.screen = 'title';
                    render();
                }, 800);
            } catch (e) {
                alert("데이터를 적용하는 중 오류가 발생했습니다. JSON 형식을 확인해주세요.");
                console.error(e);
            }
        }

        function handleLocalFileMod(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const parsedData = JSON.parse(event.target.result);
                    applyModData(parsedData);
                } catch (err) {
                    alert("JSON 파일 파싱 실패: 파일 형식이 올바르지 않습니다.");
                }
            };
            reader.readAsText(file);
        }

        function fetchModFromUrl() {
            const url = document.getElementById('input-mod-url').value.trim();
            if (!url) {
                alert("클라우드 URL을 입력하세요!");
                return;
            }

            const btn = document.getElementById('btn-load-url');
            btn.innerText = "불러오는 중...";
            btn.disabled = true;

            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error("네트워크 응답이 정상이 아닙니다.");
                    return res.json();
                })
                .then(data => {
                    applyModData(data);
                })
                .catch(err => {
                    alert("URL에서 데이터를 불러오지 못했습니다. (CORS 정책, 주소 오타, JSON 형식 오류 등을 확인하세요.)\n\n상세 오류: " + err.message);
                    btn.innerText = "불러오기";
                    btn.disabled = false;
                });
        }

        // ==========================================
        // 2-2. 전리품 동적 생성 및 태그 상속 로직
        // ==========================================
        function generateMonsterLoot(monsterId) {
            const monster = MONSTERS[monsterId];
            if (!monster) return [];

            let loots = [];

            monster.drops.forEach(drop => {
                if (Math.random() <= drop.prob) {
                    let itemName = `${monster.name} ${drop.partName}`;
                    let itemId = `dynamic_${monsterId}_${drop.baseTag}_${Math.floor(Math.random() * 10000)}`;

                    // 💡 수치가 필요한 속성/효과 태그만 담을 빈 객체
                    let itemTags = {};

                    // 몬스터의 특성 상속 (물성은 제외)
                    for (const [tagKey, tagValue] of Object.entries(monster.tags)) {
                        const tagDef = TAGS[tagKey];
                        if (tagDef && tagDef.type !== 'material') {
                            let inheritedValue = Math.floor(tagValue * (0.5 + Math.random() * 0.5));
                            if (inheritedValue > 0) {
                                itemTags[tagKey] = inheritedValue;
                            }
                        }
                    }

                    // 아이콘 동적 설정
                    let icon = '📦';
                    if (drop.baseTag === 'leather') icon = '📜';
                    else if (drop.baseTag === 'bone' || drop.baseTag === 'fang') icon = '🦴';
                    else if (drop.baseTag === 'meat') icon = '🍖';
                    else if (drop.baseTag === 'essence') icon = '✨';
                    else if (drop.baseTag === 'ore') icon = '🪨';

                    // 아이템 사전에 동적 등록
                    ITEMS[itemId] = {
                        id: itemId,
                        name: itemName,
                        icon: icon,
                        w: 1,
                        h: 1,
                        type: 'material', // 아이템 종류 (소모품/무기/재료 등)
                        material: drop.baseTag, // 💡 물성은 수치 없이 오직 여기서만 문자열로 관리됨!
                        desc: `[${monster.name}]에게서 얻어낸 ${drop.partName}입니다.`,
                        maxDurability: 100,
                        tags: itemTags // 수치가 있는 속성/효과 태그만 할당
                    };

                    loots.push(itemId);
                }
            });

            return loots;
        }

        // --- 테스트용/이해를 돕기 위한 예시 함수 ---
        function testHuntMonster(monsterId) {
            const lootedItemIds = generateMonsterLoot(monsterId);

            if (lootedItemIds.length === 0) {
                showToast("아무것도 얻지 못했습니다...");
                return;
            }

            lootedItemIds.forEach(id => {
                const item = ITEMS[id];

                // 디버깅용 텍스트 출력
                let tagDesc = Object.entries(item.tags).map(([k, v]) => `${TAGS[k].name}(${v})`).join(', ');
                console.log(`[전리품] ${item.name} | 재질: ${TAGS[item.material].name} | 부가 속성: { ${tagDesc || '없음'} }`);
            });
        }

        // ==========================================
        // 2-1. 로컬 assets에서 몬스터 데이터 로드
        // ==========================================
        async function fetchMonsterData() {
            const url = "assets/monsters.json";

            try {
                if (location.protocol === "file:") {
                    throw new Error("file:// 환경에서는 fetch가 제한될 수 있습니다.");
                }
                const response = await fetch(url);
                if (!response.ok) throw new Error("서버 응답 오류");

                const data = await response.json();
                MONSTERS = data;
                console.log("✅ 몬스터 데이터를 성공적으로 불러왔습니다.", MONSTERS);
            } catch (err) {
                console.warn("⚠️ 몬스터 데이터를 불러오지 못했습니다. 기본 테스트 몬스터를 로드합니다.", err);
                // 통신 실패 시 게임이 멈추지 않도록 임시 데이터(Fallback) 주입
                MONSTERS = {
                    "silver_wolf": {
                        id: "silver_wolf",
                        name: "실버 울프",
                        // 몬스터 자체가 지닌 본연의 태그들
                        tags: {
                            ice: 30,
                            mana: 10,
                            sharp: 20,
                            wild: 10
                        },
                        // 처치 시 얻을 수 있는 부위(드랍 테이블)
                        drops: [{
                                partName: "가죽",
                                baseTag: "leather",
                                baseValue: 100,
                                prob: 0.8
                            },
                            {
                                partName: "이빨",
                                baseTag: "fang",
                                baseValue: 80,
                                prob: 0.5
                            },
                            {
                                partName: "얼음 정수",
                                baseTag: "ice",
                                baseValue: 150,
                                prob: 0.1
                            }
                        ]
                    },
                    "cave_spider": {
                        id: "cave_spider",
                        name: "동굴 거미",
                        tags: {
                            poison: 50,
                            dark: 10,
                            stink: 20
                        },
                        drops: [{
                                partName: "독샘",
                                baseTag: "poison",
                                baseValue: 100,
                                prob: 0.6
                            },
                            {
                                partName: "갑각",
                                baseTag: "carapace",
                                baseValue: 70,
                                prob: 0.7
                            }
                        ]
                    }
                };
            }
        }
