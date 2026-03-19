        // ==========================================
        // 1. 글로벌 상수 및 데이터 모델 (모딩 가능하게 let으로 선언)
        // ==========================================
        const MAP_SIZE = 200;
        const DEFAULT_BONUS_POINTS = 30;
        const REINCARNATION_BONUS_POINTS = 40;
        const BASE_GOLD = 500;
        const TURN_AP = 7;

        let hatchPattern = null;

        function getHatchPattern(ctx) {
            if (hatchPattern) return hatchPattern;
            const patternCanvas = document.createElement('canvas');
            patternCanvas.width = 8;
            patternCanvas.height = 8;
            const pctx = patternCanvas.getContext('2d');
            pctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            pctx.lineWidth = 1;
            pctx.beginPath();
            pctx.moveTo(0, 8);
            pctx.lineTo(8, 0);
            pctx.stroke();
            hatchPattern = ctx.createPattern(patternCanvas, 'repeat');
            return hatchPattern;
        }

        // --- 외부(클라우드/로컬)에서 불러올 수 있는 핵심 데이터셋 ---
        let SETTLEMENT_TIERS = {
            camp: {
                id: 'camp',
                name: '정착지',
                minPop: 1,
                maxTiles: 1,
                icon: '⛺'
            },
            village: {
                id: 'village',
                name: '마을',
                minPop: 50,
                maxTiles: 1,
                icon: '🏕️'
            },
            town: {
                id: 'town',
                name: '읍성(소도시)',
                minPop: 500,
                maxTiles: 2,
                icon: '🏡'
            },
            city: {
                id: 'city',
                name: '도시',
                minPop: 3000,
                maxTiles: 4,
                icon: '🏯'
            },
            metropolis: {
                id: 'metropolis',
                name: '대도시',
                minPop: 15000,
                maxTiles: 6,
                icon: '🏰'
            }
        };

        let BUILDINGS = {
            farm: {
                id: 'farm',
                name: '마을 논밭',
                icon: '🌾',
                desc: '마을의 식량을 생산하는 비옥한 농경지입니다.',
                w: 3,
                h: 3
            },
            house: {
                id: 'house',
                name: '주민 거주구역',
                icon: '🏠',
                desc: '주민들이 모여 사는 평화로운 거주지입니다.',
                w: 2,
                h: 2
            },
            plaza: {
                id: 'plaza',
                name: '중앙 광장',
                icon: '⛲',
                desc: '마을 사람들이 모이는 열린 광장입니다.',
                w: 4,
                h: 4
            },
            hut: {
                id: 'hut',
                name: '임시 오두막',
                icon: '🛖',
                desc: '비바람을 간신히 피할 수 있는 열악한 거처입니다.',
                w: 2,
                h: 2
            },
            well: {
                id: 'well',
                name: '공용 우물',
                icon: '🪣',
                desc: '마을의 귀중한 식수원입니다.',
                w: 1,
                h: 1
            },
            storage: {
                id: 'storage',
                name: '마을 창고',
                icon: '📦',
                desc: '공동 식량과 자원을 보관하는 장소입니다.',
                w: 2,
                h: 3
            },
            campfire: {
                id: 'campfire',
                name: '모닥불 터',
                icon: '🔥',
                desc: '캐릭터들의 체력을 소폭 회복하거나 간단한 요리를 할 수 있는 휴식 공간입니다.',
                w: 2,
                h: 2
            },
            noticeboard: {
                id: 'noticeboard',
                name: '의뢰 게시판',
                icon: '📜',
                desc: '기초적인 토벌 의뢰나 심부름을 확인하는 게시판입니다.',
                w: 1,
                h: 1
            },
            herb_rack: {
                id: 'herb_rack',
                name: '약초 건조대',
                icon: '🌿',
                desc: '필드에서 채집한 약초를 포션 재료로 가공하는 기초 연금술 시설입니다.',
                w: 2,
                h: 1
            },
            chief_house: {
                id: 'chief_house',
                name: '촌장의 집',
                icon: '🏡',
                desc: '마을의 대소사를 결정하고 행정을 담당하는 곳입니다.',
                w: 3,
                h: 3
            },
            tavern: {
                id: 'tavern',
                name: '뒷골목 주점',
                icon: '🍻',
                desc: '소문을 듣고, 퀘스트를 수주하거나, 든든한 용병을 고용합니다.',
                w: 3,
                h: 3
            },
            inn: {
                id: 'inn',
                name: '여행자 여관',
                icon: '🛏️',
                desc: '안전하게 휴식을 취하며 세이브를 진행할 수 있습니다.',
                w: 3,
                h: 4
            },
            blacksmith: {
                id: 'blacksmith',
                name: '명장의 대장간',
                icon: '🔨',
                desc: '수집한 재료로 무기와 방어구를 제작하거나 수리합니다.',
                w: 3,
                h: 3
            },
            chapel: {
                id: 'chapel',
                name: '마을 예배당',
                icon: '⛪',
                desc: '디버프(저주) 해제, 부활, 축복을 받는 곳입니다.',
                w: 3,
                h: 3
            },
            training_ground: {
                id: 'training_ground',
                name: '훈련장',
                icon: '🎯',
                desc: '캐릭터의 스킬을 연마하거나 소량의 경험치를 획득할 수 있습니다.',
                w: 4,
                h: 4
            },
            general_store: {
                id: 'general_store',
                name: '잡화점',
                icon: '🛍️',
                desc: '탐험에 필수적인 소모성 아이템을 판매합니다.',
                w: 2,
                h: 3
            },
            dojo: {
                id: 'dojo',
                name: '중앙 수련장',
                icon: '⚔️',
                desc: '무력을 수련하거나, 검술 유파를 창설해 제자를 거둡니다.',
                w: 4,
                h: 4
            },
            guardhouse: {
                id: 'guardhouse',
                name: '위병소',
                icon: '🛡️',
                desc: '치안을 담당하며, 난이도 높은 현상범 수배 전단이 붙는 곳입니다.',
                w: 3,
                h: 3
            },
            market: {
                id: 'market',
                name: '시장',
                icon: '🛒',
                desc: '특정 요일마다 희귀한 재료를 파는 상인들이 방문합니다.',
                w: 5,
                h: 4
            },
            library: {
                id: 'library',
                name: '기록 보관소',
                icon: '📚',
                desc: '세계관의 전설이나 몬스터의 약점 정보를 해금하는 곳입니다.',
                w: 3,
                h: 3
            },
            stable: {
                id: 'stable',
                name: '마구간',
                icon: '🐎',
                desc: '필드 이동 속도를 높여주는 탈것(말, 당나귀 등)을 관리합니다.',
                w: 4,
                h: 3
            },
            manor: {
                id: 'manor',
                name: '영주관',
                icon: '🏰',
                desc: '지역을 다스리는 영주의 거처로, 영지 관리 및 알현이 가능합니다.',
                w: 5,
                h: 5
            },
            mage_tower: {
                id: 'mage_tower',
                name: '마법사 탑',
                icon: '🔮',
                desc: '고위 마법 스킬을 배우거나 마법 장비를 감정/강화하는 곳입니다.',
                w: 4,
                h: 4
            },
            alchemy_lab: {
                id: 'alchemy_lab',
                name: '연금술 공방',
                icon: '⚗️',
                desc: '전문적인 포션 제조 및 무기 속성 부여가 가능합니다.',
                w: 3,
                h: 3
            },
            guild_office: {
                id: 'guild_office',
                name: '길드 사무소',
                icon: '🤝',
                desc: '모험가, 상인 등 파벌과 접촉하여 특수 퀘스트를 수령합니다.',
                w: 4,
                h: 3
            },
            bank: {
                id: 'bank',
                name: '중앙 은행',
                icon: '💰',
                desc: '대량의 골드를 보관하거나 아이템 창고를 대폭 확장합니다.',
                w: 3,
                h: 4
            },
            castle: {
                id: 'castle',
                name: '왕성',
                icon: '👑',
                desc: '국가에 임관을 요청하거나, 거대한 메인 퀘스트를 진행합니다.',
                w: 6,
                h: 6
            },
            club: {
                id: 'club',
                name: '귀족 사교장',
                icon: '🍷',
                desc: '고위층 인물들과 교류하며 호감도와 정치적 영향력을 쌓습니다.',
                w: 4,
                h: 4
            },
            grand_cathedral: {
                id: 'grand_cathedral',
                name: '대성당',
                icon: '🕍',
                desc: '강력한 신성 버프나 전설적 유물 정화가 가능합니다.',
                w: 5,
                h: 6
            },
            arena: {
                id: 'arena',
                name: '투기장',
                icon: '🏟️',
                desc: '자신의 파티 실력을 증명하고 고유 장비를 얻는 시설입니다.',
                w: 6,
                h: 6
            },
            port: {
                id: 'port',
                name: '항구/비공정 계류장',
                icon: '⚓',
                desc: '다른 대륙이나 숨겨진 특수 지역으로 이동할 수 있습니다.',
                w: 5,
                h: 5
            }
        };

        let MAP_RESOURCES = [{
                id: 'iron',
                name: '철광맥',
                icon: '🪨',
                desc: '기본적인 무구 제련에 필요한 철광석입니다.',
                terrains: ['mountain', 'rock'],
                prob: 0.04
            },
            {
                id: 'mithril',
                name: '미스릴 광맥',
                icon: '✨',
                desc: '마력을 머금은 은빛 금속입니다. 가볍고 단단합니다.',
                terrains: ['mountain', 'snow'],
                prob: 0.01
            },
            {
                id: 'mana_crystal',
                name: '마나 결정',
                icon: '💎',
                desc: '순수한 마나가 응집된 결정체로, 마법 도구 제작에 필수입니다.',
                terrains: ['mountain', 'forest', 'world_tree'],
                prob: 0.015
            },
            {
                id: 'ancient_relic',
                name: '고대 유물',
                icon: '🏺',
                desc: '잊혀진 시대의 유적 파편입니다. 학자들이 비싸게 매입합니다.',
                terrains: ['sand', 'forest'],
                prob: 0.01
            },
            {
                id: 'rare_herb',
                name: '희귀 영약초',
                icon: '🌿',
                desc: '깊은 숲에서만 자라나는 신비한 약초로 강력한 포션의 재료입니다.',
                terrains: ['forest', 'grass', 'world_tree'],
                prob: 0.03
            },
            {
                id: 'spirit_tear',
                name: '정령의 눈물',
                icon: '💧',
                desc: '정령의 슬픔이 맺힌 보석. 극상의 마력 회복제 재료가 됩니다.',
                terrains: ['forest', 'water', 'snow'],
                prob: 0.008
            },
            {
                id: 'gold_vein',
                name: '황금 광맥',
                icon: '💰',
                desc: '자연산 황금이 묻혀있는 광맥입니다. 큰 부를 안겨줍니다.',
                terrains: ['mountain', 'sand'],
                prob: 0.01
            },
            {
                id: 'truffle',
                name: '환상의 송로버섯',
                icon: '🍄',
                desc: '미식가들이 환장하는 최고급 식재료입니다.',
                terrains: ['forest'],
                prob: 0.02
            }
        ];

        let RACES = {
            human: {
                id: 'human',
                name: '인간',
                icon: '🧑',
                desc: '뛰어난 적응력과 번식력. 모든 능력이 고르게 발달했습니다.',
                baseStats: {
                    str: 50,
                    mag: 50,
                    agi: 50,
                    cha: 60
                }
            },
            elf: {
                id: 'elf',
                name: '엘프',
                icon: '🧝',
                desc: '세계수의 축복. 근력은 약하나 마력과 민첩이 뛰어납니다.',
                baseStats: {
                    str: 35,
                    mag: 85,
                    agi: 70,
                    cha: 50
                }
            },
            dragonborn: {
                id: 'dragonborn',
                name: '용인',
                icon: '🐲',
                desc: '고대 용의 피를 이어받은 종족. 압도적인 근력과 내구력을 자랑합니다.',
                baseStats: {
                    str: 85,
                    mag: 40,
                    agi: 45,
                    cha: 30
                }
            },
            dwarf: {
                id: 'dwarf',
                name: '드워프',
                icon: '🧔',
                desc: '대지의 축복. 튼튼한 체력과 훌륭한 손재주를 지녔습니다.',
                baseStats: {
                    str: 75,
                    mag: 30,
                    agi: 35,
                    cha: 45
                }
            }
        };

        let TRAITS = {
            reincarnator: {
                id: 'reincarnator',
                name: '이세계 환생',
                tier: '유일',
                icon: '✨',
                desc: '전생의 기억을 가집니다. 보너스 스탯이 +10 되며 환생 포인트를 얻습니다.',
                acq: 'innate',
                cat: 'mental',
                reqGender: null
            },
            regressor: {
                id: 'regressor',
                name: '회귀자',
                tier: '유일',
                icon: '⏳',
                desc: '과거의 특정 시점에서 삶을 다시 시작합니다. 회귀 포인트를 지닙니다.',
                acq: 'innate',
                cat: 'mental',
                reqGender: null
            },
            possessor: {
                id: 'possessor',
                name: '빙의자',
                tier: '유일',
                icon: '👻',
                desc: '현존하는 타인의 육체를 차지하여 시작합니다. 사망 시 다른 육체로 빙의 가능.',
                acq: 'innate',
                cat: 'mental',
                reqGender: null
            },
            demon_vessel: {
                id: 'demon_vessel',
                name: '마왕의 그릇',
                tier: '유일',
                icon: '👿',
                desc: '흑마법 위력 100% 증가. 체력 30% 이하 시 이성을 잃고 폭주합니다.',
                acq: 'innate',
                cat: 'mental',
                reqGender: null
            },
            sword_saint: {
                id: 'sword_saint',
                name: '검성',
                tier: '유일',
                icon: '⚔️',
                desc: '검 장착 시 반격 무시 및 방어 관통 50%. 마법을 일절 사용할 수 없습니다.',
                acq: 'innate',
                cat: 'physical',
                reqGender: null
            },
            tree_blessing: {
                id: 'tree_blessing',
                name: '세계수의 축복',
                tier: '유일',
                icon: '🌳',
                desc: '매 턴 파티 전체의 체력/마나 지속 회복. 모든 지형 피해를 무시합니다.',
                acq: 'innate',
                cat: 'other',
                reqGender: null
            },
            dragon_slayer: {
                id: 'dragon_slayer',
                name: '용살자',
                tier: '전설',
                icon: '🗡️',
                desc: '드래곤 타입 적에게 데미지 2배. 공포/위압 계열 상태이상 영구 면역.',
                acq: 'acquired',
                cat: 'physical',
                reqGender: null
            },
            lucky_bastard: {
                id: 'lucky_bastard',
                name: '기연 비틱',
                tier: '전설',
                icon: '💰',
                desc: '희귀 아이템 드랍률 50% 증가. 모든 상점 구매 시 20% 할인 혜택.',
                acq: 'innate',
                cat: 'other',
                reqGender: null
            },
            phoenix_blood: {
                id: 'phoenix_blood',
                name: '불사조의 피',
                tier: '전설',
                icon: '🔥',
                desc: '사망 시 체력 50%로 즉시 부활 (전투당 1회).',
                acq: 'innate',
                cat: 'physical',
                reqGender: null
            },
            nine_yang: {
                id: 'nine_yang',
                name: '구양절맥',
                tier: '영웅',
                icon: '☀️',
                desc: '화염 마법 위력 대폭 증가 및 화상 면역. 매 턴 화상 피해를 입습니다.',
                acq: 'innate',
                cat: 'physical',
                reqGender: 'M'
            },
            nine_yin: {
                id: 'nine_yin',
                name: '구음절맥',
                tier: '영웅',
                icon: '❄️',
                desc: '한빙 마법 위력 대폭 증가 및 빙결 면역. 턴 행동 속도가 감소합니다.',
                acq: 'innate',
                cat: 'physical',
                reqGender: 'F'
            },
            berserker: {
                id: 'berserker',
                name: '광전사',
                tier: '영웅',
                icon: '😡',
                desc: '체력이 낮을수록 공격력이 폭증합니다. 20% 이하 시 조작 불가.',
                acq: 'innate',
                cat: 'physical',
                reqGender: null
            },
            mana_affinity: {
                id: 'mana_affinity',
                name: '마나 친화',
                tier: '영웅',
                icon: '✨',
                desc: '모든 마법의 마나 소모량이 25% 감소하며, 매 턴 마나를 회복합니다.',
                acq: 'innate',
                cat: 'mental',
                reqGender: null
            },
            blood_contract: {
                id: 'blood_contract',
                name: '피의 계약자',
                tier: '영웅',
                icon: '🩸',
                desc: '마나가 부족할 때 자신의 체력을 대신 소모하여 마법이나 스킬을 강제로 사용할 수 있습니다.',
                acq: 'innate',
                cat: 'physical',
                reqGender: null
            },
            commander: {
                id: 'commander',
                name: '통솔자',
                tier: '희귀',
                icon: '🚩',
                desc: '용병 고용 비용 감소. 자신이 리더일 때 파티원 명중/회피 상승.',
                acq: 'innate',
                cat: 'mental',
                reqGender: null
            },
            steel_body: {
                id: 'steel_body',
                name: '강철의 육체',
                tier: '희귀',
                icon: '🛡️',
                desc: '받는 물리피해 15% 감소. 기절 저항. 행동이 약간 둔해집니다.',
                acq: 'innate',
                cat: 'physical',
                reqGender: null
            },
            venomous: {
                id: 'venomous',
                name: '독종',
                tier: '희귀',
                icon: '🐍',
                desc: '자신 중독 시 공격력이 크게 증가하며 적 단일 대상 맹독 부여 확률이 상승합니다.',
                acq: 'innate',
                cat: 'physical',
                reqGender: null
            },
            mind_reader: {
                id: 'mind_reader',
                name: '독심술',
                tier: '희귀',
                icon: '👁️',
                desc: '대화 시 상대방의 숨겨진 호감도 수치와 거짓말 여부를 정확히 꿰뚫어 봅니다.',
                acq: 'innate',
                cat: 'mental',
                reqGender: null
            },
            master_crafter: {
                id: 'master_crafter',
                name: '장인의 손길',
                tier: '희귀',
                icon: '🔨',
                desc: '대장간에서 아이템 제작/강화 시 무조건 1단계 높은 품질이 결과물로 나오며, 내구도가 소폭 높습니다.',
                acq: 'acquired',
                cat: 'other',
                reqGender: null
            },
            glutton: {
                id: 'glutton',
                name: '대식가',
                tier: '일반',
                icon: '🍖',
                desc: '음식 아이템 효과 1.5배. 필드 이동 시 식량 소모 2배.',
                acq: 'innate',
                cat: 'physical',
                reqGender: null
            },
            glass_cannon: {
                id: 'glass_cannon',
                name: '유리대포',
                tier: '일반',
                icon: '💥',
                desc: '가하는 모든 피해량 15% 증가. 받는 모든 피해량 20% 증가.',
                acq: 'innate',
                cat: 'physical',
                reqGender: null
            },
            animal_friend: {
                id: 'animal_friend',
                name: '동물 친화',
                tier: '일반',
                icon: '🐾',
                desc: '야생 동물이나 마물에게 먼저 공격받지 않으며, 길들이기 성공 확률이 크게 오릅니다.',
                acq: 'innate',
                cat: 'other',
                reqGender: null
            },
            merchant_king: {
                id: 'merchant_king',
                name: '상술의 달인',
                tier: '일반',
                icon: '⚖️',
                desc: '아이템 판매 시 15% 비싸게 팔고, 구매 시 15% 싸게 사는 흥정의 귀재입니다.',
                acq: 'acquired',
                cat: 'mental',
                reqGender: null
            }
        };

        let NATION_TEMPLATES = [{
                name: '사자왕국',
                desc: '인간 중심의 강력한 왕국',
                color: 'rgba(239, 68, 68, 0.45)'
            },
            {
                name: '실마릴리온',
                desc: '숲을 지키는 엘프 연합',
                color: 'rgba(34, 197, 94, 0.45)'
            },
            {
                name: '붉은비늘 군락',
                desc: '거친 용인들의 대규모 군락',
                color: 'rgba(168, 85, 247, 0.45)'
            },
            {
                name: '무쇠모루 연맹',
                desc: '산을 깎아 만든 드워프 도시국가',
                color: 'rgba(234, 179, 8, 0.45)'
            },
            {
                name: '자유도시 연합',
                desc: '다종족 상업 연맹체',
                color: 'rgba(59, 130, 246, 0.45)'
            }
        ];

        let AMBITIONS = {
            peaceful: {
                id: 'peaceful',
                name: '평온한 삶',
                icon: '🍃',
                desc: '현재의 평화로운 일상을 유지하고 소박한 행복을 추구합니다.'
            },
            sword_master: {
                id: 'sword_master',
                name: '세계 제일의 검사',
                icon: '⚔️',
                desc: '끊임없는 수련과 명검 탐색을 통해 무의 극의에 달하고자 합니다.'
            },
            world_conquest: {
                id: 'world_conquest',
                name: '세계 정복',
                icon: '👑',
                desc: '세상의 모든 것을 지배하는 절대 권력자가 되길 원합니다.'
            },
            revenge: {
                id: 'revenge',
                name: '피의 복수',
                icon: '🩸',
                desc: '가족을 죽인 원수에게 처절한 복수를 다짐했습니다. (대상: {target})'
            },
            wealth: {
                id: 'wealth',
                name: '대륙의 거부',
                icon: '💰',
                desc: '세상의 모든 부를 긁어모아 최고의 부자가 되는 것이 꿈입니다.'
            },
            knowledge: {
                id: 'knowledge',
                name: '진리의 탐구자',
                icon: '📚',
                desc: '세상의 숨겨진 모든 지식과 마법의 비밀을 파헤치고자 합니다.'
            }
        };


        // ==========================================
        // 1-3. 태그 시스템 사전 (고정 데이터)
        // ==========================================
        let TAGS = {
            // --- [물성(재질) 태그] : 주로 아이템의 기본 바탕이 됨 ---
            leather: {
                name: '가죽',
                type: 'material',
                desc: '질기고 유연합니다.'
            },
            bone: {
                name: '뼈',
                type: 'material',
                desc: '단단한 골격재입니다.'
            },
            meat: {
                name: '살점',
                type: 'material',
                desc: '식량이나 미끼로 쓰입니다.'
            },
            scale: {
                name: '비늘',
                type: 'material',
                desc: '매끄럽고 마법 저항력이 있습니다.'
            },
            carapace: {
                name: '갑각',
                type: 'material',
                desc: '물리적인 충격을 튕겨냅니다.'
            },
            fang: {
                name: '이빨/발톱',
                type: 'material',
                desc: '날카로운 관통력을 가집니다.'
            },
            wood: {
                name: '목재',
                type: 'material',
                desc: '가공하기 쉬운 나무입니다.'
            },
            ore: {
                name: '광석',
                type: 'material',
                desc: '단단한 금속의 원석입니다.'
            },
            // --- [물성(재질) 태그] ---
            // ... (기존 가죽, 뼈 등등)
            herb: {
                name: '약초',
                type: 'material',
                desc: '생명력이 깃든 식물입니다.'
            },
            essence: {
                name: '정수',
                type: 'material',
                desc: '마력과 생명력이 응집된 신비한 결정체입니다.'
            }, // 💡 추가된 부분

            // --- [속성 태그] : 몬스터의 성질이 아이템에 깃듦 ---
            fire: {
                name: '화염',
                type: 'element',
                desc: '뜨거운 열기를 품고 있습니다.'
            },
            ice: {
                name: '한기',
                type: 'element',
                desc: '닿는 것을 얼려버립니다.'
            },
            wind: {
                name: '바람',
                type: 'element',
                desc: '가볍고 날렵한 기운입니다.'
            },
            earth: {
                name: '대지',
                type: 'element',
                desc: '묵직하고 견고한 기운입니다.'
            },
            lightning: {
                name: '번개',
                type: 'element',
                desc: '짜릿한 전류가 흐릅니다.'
            },
            mana: {
                name: '순수 마나',
                type: 'element',
                desc: '응축된 마력이 요동칩니다.'
            },
            holy: {
                name: '신성',
                type: 'element',
                desc: '사악한 것을 정화하는 빛입니다.'
            },
            dark: {
                name: '암흑',
                type: 'element',
                desc: '빛을 흡수하는 탁한 기운입니다.'
            }, // 코즈믹 호러가 아닌 일반 흑마법/마족 계열

            // --- [효과(상태이상/버프) 태그] ---
            poison: {
                name: '맹독',
                type: 'effect',
                isDebuff: true,
                desc: '치명적인 독성을 띱니다.'
            },
            paralysis: {
                name: '마비',
                type: 'effect',
                isDebuff: true,
                desc: '신경을 마비시키는 성분이 있습니다.'
            },
            bleed: {
                name: '출혈',
                type: 'effect',
                isDebuff: true,
                desc: '상처를 헤집어 피를 멎지 않게 합니다.'
            },
            stink: {
                name: '악취',
                type: 'effect',
                isDebuff: true,
                desc: '코를 찌르는 냄새로 은신을 방해합니다.'
            },
            heavy: {
                name: '무거움',
                type: 'effect',
                isDebuff: true,
                desc: '행동을 둔하게 만들지만 파괴력이 높습니다.'
            },

            regen: {
                name: '재생',
                type: 'effect',
                isDebuff: false,
                desc: '생명력을 서서히 회복시킵니다.'
            },
            sharp: {
                name: '예리함',
                type: 'effect',
                isDebuff: false,
                desc: '무언가를 베어내기 최적화되어 있습니다.'
            },
            light_weight: {
                name: '가벼움',
                type: 'effect',
                isDebuff: false,
                desc: '바람처럼 가벼워 민첩성이 오릅니다.'
            },
            warm: {
                name: '보온',
                type: 'effect',
                isDebuff: false,
                desc: '체온을 유지시켜 줍니다.'
            }
        };

        // 로컬 assets에서 불러올 몬스터 데이터를 담을 빈 객체
        let MONSTERS = {};

        // 아이템 스탯 및 내구도 데이터 추가
        let ITEMS = {
            sword_basic: {
                id: 'sword_basic',
                name: '철검',
                icon: '🗡️',
                w: 1,
                h: 3,
                type: 'hand',
                desc: '평범한 대장장이가 만들어낸 철제 검입니다. 묵직하고 실용적입니다.',
                material: 'iron',
                maxDurability: 100,
                stats: {
                    attack: 5
                }
            },
            helmet_iron: {
                id: 'helmet_iron',
                name: '기사단 투구',
                icon: '🪖',
                w: 2,
                h: 2,
                type: 'head',
                desc: '정규 기사단에 납품되는 튼튼한 철제 투구입니다.',
                material: 'iron',
                maxDurability: 120,
                stats: {
                    defense: 8
                }
            },
            potion_hp: {
                id: 'potion_hp',
                name: '체력 물약',
                icon: '🧪',
                w: 1,
                h: 1,
                type: 'consumable',
                desc: '붉은빛이 감도는 영약. 마시면 즉시 체력을 30 회복합니다.',
                material: 'herb',
                maxDurability: 1,
                stats: {
                    heal: 30
                }
            },
            leather_bag: {
                id: 'leather_bag',
                name: '모험가의 배낭',
                icon: '🎒',
                w: 2,
                h: 2,
                type: 'back',
                bagGrid: {
                    w: 4,
                    h: 4
                },
                desc: '질긴 가죽으로 만들어진 배낭입니다. 추가적인 수납 공간을 제공합니다.',
                material: 'leather',
                maxDurability: 50
            },
            garter_belt: {
                id: 'garter_belt',
                name: '비밀의 가터링',
                icon: '🧦',
                w: 1,
                h: 1,
                type: 'thigh',
                bagGrid: {
                    w: 2,
                    h: 3
                },
                desc: '허벅지에 묶어 단검이나 작은 물건을 숨길 수 있는 은밀한 장비입니다.',
                material: 'leather',
                maxDurability: 30,
                stats: {
                    agi: 1
                }
            },
            dagger_basic: {
                id: 'dagger_basic',
                name: '은밀한 단검',
                icon: '🗡️',
                w: 1,
                h: 2,
                type: 'hand',
                desc: '품 속에 숨기기 좋은 짧고 날카로운 단검입니다.',
                material: 'iron',
                maxDurability: 80,
                stats: {
                    attack: 3,
                    agi: 1
                }
            },
            adult_toy: {
                id: 'adult_toy',
                name: '요상한 구슬',
                icon: '🔮',
                w: 1,
                h: 1,
                type: 'vagina',
                adult: true,
                desc: '알 수 없는 진동이 느껴지는 마법 도구입니다. 은밀한 부위에 장착합니다...',
                material: 'mana_crystal',
                maxDurability: 30
            }
        };

        // ==========================================
        // 1-2. 시설별 행동 사전 (플레이어/NPC 공통 사용)
        // ==========================================
        let FACILITY_ACTIONS = {
            tavern: [{
                    name: '소문 수집',
                    cost: 0,
                    goldCost: 10,
                    icon: '🍻'
                },
                {
                    name: '용병 고용 알아보기',
                    cost: 1,
                    icon: '📝'
                }
            ],
            blacksmith: [{
                    name: '명검 제련 의뢰',
                    cost: 3,
                    icon: '🔨'
                },
                {
                    name: '장비 수리',
                    cost: 1,
                    icon: '🔧'
                }
            ],
            dojo: [{
                    name: '개인 수련 (경험치)',
                    cost: 4,
                    icon: '🎯',
                    statUp: 'str'
                },
                {
                    name: '유파 창설 선포',
                    cost: 7,
                    icon: '⚔️',
                    statUp: 'cha'
                }
            ],
            training_ground: [{
                name: '개인 수련 (경험치)',
                cost: 4,
                icon: '🎯',
                statUp: 'str'
            }],
            castle: [{
                    name: '영주 알현 요청',
                    cost: 2,
                    icon: '👑'
                },
                {
                    name: '영지 세금 징수',
                    cost: 1,
                    icon: '📜',
                    getGold: 50
                }
            ],
            manor: [{
                    name: '영주 알현 요청',
                    cost: 2,
                    icon: '👑'
                },
                {
                    name: '영지 세금 징수',
                    cost: 1,
                    icon: '📜',
                    getGold: 30
                }
            ],
            chief_house: [{
                    name: '촌장/영주 알현',
                    cost: 2,
                    icon: '👑'
                },
                {
                    name: '영지 세금 징수',
                    cost: 1,
                    icon: '📜',
                    getGold: 10
                }
            ],
            club: [{
                    name: '사교 파티 참석',
                    cost: 3,
                    icon: '🍷',
                    statUp: 'cha'
                },
                {
                    name: '구애하기',
                    cost: 4,
                    icon: '💐',
                    reqAdult: false
                },
                {
                    name: '은밀한 밀회',
                    cost: 5,
                    icon: '💋',
                    reqAdult: true
                }
            ],
            farm: [{
                name: '농사 일손 돕기',
                cost: 2,
                icon: '🌾',
                getGold: 5,
                statUp: 'str'
            }],
            house: [{
                name: '주민과 담소 나누기',
                cost: 1,
                icon: '🗣️',
                statUp: 'cha'
            }],
            hut: [{
                name: '주민과 담소 나누기',
                cost: 1,
                icon: '🗣️'
            }],
            plaza: [{
                name: '군중 속에 섞여 쉬기',
                cost: 2,
                icon: '⛲'
            }],
            campfire: [{
                    name: '모닥불 휴식 (체력회복)',
                    cost: 3,
                    icon: '🔥'
                },
                {
                    name: '간단한 요리',
                    cost: 1,
                    icon: '🍖'
                }
            ],
            noticeboard: [{
                name: '의뢰 목록 확인',
                cost: 0,
                icon: '📜'
            }],
            herb_rack: [{
                name: '포션 제조 (연금술)',
                cost: 3,
                icon: '🌿'
            }],
            alchemy_lab: [{
                name: '고급 포션 제조',
                cost: 4,
                icon: '⚗️',
                statUp: 'mag'
            }],
            chapel: [{
                    name: '신에게 기도하기',
                    cost: 2,
                    icon: '⛪'
                },
                {
                    name: '저주 해제 의식',
                    cost: 4,
                    icon: '✨'
                }
            ],
            grand_cathedral: [{
                    name: '대주교의 축복 받기',
                    cost: 3,
                    icon: '🕍'
                },
                {
                    name: '저주 해제 의식',
                    cost: 4,
                    icon: '✨'
                }
            ],
            general_store: [{
                name: '상인과 물품 거래',
                cost: 0,
                icon: '🛍️'
            }],
            market: [{
                    name: '시장 둘러보기',
                    cost: 2,
                    icon: '🛒',
                    getGold: -5
                } // 충동구매 구현
            ],
            library: [{
                name: '고문서 해독',
                cost: 4,
                icon: '📚',
                statUp: 'mag'
            }],
            stable: [{
                name: '탈것 관리 및 구매',
                cost: 0,
                icon: '🐎'
            }],
            mage_tower: [{
                    name: '마법서 열람 (학습)',
                    cost: 5,
                    icon: '🔮',
                    statUp: 'mag'
                },
                {
                    name: '아티팩트 감정',
                    cost: 2,
                    icon: '👁️'
                }
            ],
            guild_office: [{
                    name: '길드 퀘스트 수주',
                    cost: 0,
                    icon: '🤝'
                },
                {
                    name: '길드원과 교류',
                    cost: 2,
                    icon: '🍻',
                    statUp: 'cha'
                }
            ],
            bank: [{
                name: '금화 입출금 업무',
                cost: 0,
                icon: '💰'
            }],
            arena: [{
                    name: '투기장 전투 참가',
                    cost: 4,
                    icon: '🏟️',
                    statUp: 'agi',
                    getGold: 20
                },
                {
                    name: '관전 및 베팅',
                    cost: 2,
                    icon: '🎲'
                }
            ],
            port: [{
                name: '선원들과 하역 작업',
                cost: 3,
                icon: '⚓',
                statUp: 'str',
                getGold: 15
            }]
        };