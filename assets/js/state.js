        // --- 전역 게임 상태 ---
        let state = {
            screen: 'title',
            inGameTab: 'map',
            adultMode: false,
            tileSize: 15,
            cityTileSize: 15,
            showCityMap: false,
            // 도시 지도 자동 맞춤(전체가 한 화면에 보이도록)
            cityMapAutoFit: true,
            mapLayers: {
                borders: true,
                mana: false,
                light: false,
                influence: false
            },
            // 맵 레이어 패널 접힘 여부
            mapLayersCollapsed: false,
            // 미니맵 패널 접힘 여부
            minimapCollapsed: false,
            // 상단 정보 드로어 고정 여부
            topBarDrawerPinned: false,
            selectedFacility: null,
            counters: {
                nation: 1,
                npc: 1,
                settlement: 1,
                building: 1
            },
            isAnimating: false,
            animatingLocation: null,
            player: {
                id: 'player_0',
                name: '',
                gender: 'M',
                age: '',
                height: '',
                weight: '',
                race: 'human',
                health: 100,
                isDead: false,
                originType: null,
                parents: null,
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
                movementHistory: [],
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
                    }, {
                        id: 'garter_belt',
                        x: 2,
                        y: 0,
                        durability: 30
                    }, {
                        id: 'dagger_basic',
                        x: 3,
                        y: 0,
                        durability: 80
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
                fiefdoms: [],
                creations: [],
                rp: 0,
                pp: 0,
                ip: 0,
                regressionYear: 52
            },
            npcs: [],
            origins: [],
            settlements: [],
            gameDate: {
                year: 52,
                month: 3,
                week: 1
            },
            worldMap: null,
            history: {
                nations: [],
                logs: [],
                currentTurn: 0,
                maxTurn: 1000,
                intervalId: null
            },
            selectedTileInfo: null,
            turnLogs: []
        };

        let debugState = {
            npcRace: 'all',
            npcNation: 'all',
            logRange: '1'
        };
        let secretClickCount = 0;
        let isDraggingMap = false;
        let isDraggingItem = false;

        // 💡 운명 고정 이스터에그 변수 추가
        let traitLabelClickCount = 0;
        let traitLockMode = false;
        let lockedTraitsList = [];

        const appEl = document.getElementById('app');
