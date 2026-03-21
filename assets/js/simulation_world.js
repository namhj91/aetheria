        // ==========================================
        // 3. 턴 & 확장 처리 (문명 방식)
        // ==========================================
        function expandInfluence(s) {
            if (!s.influencedTiles || s.influencedTiles.length === 0) return false;
            let candidates = [];
            let visited = new Set(s.influencedTiles.map(t => `${t.x},${t.y}`));
            let cx = s.tiles[0].x;
            let cy = s.tiles[0].y;

            for (let t of s.influencedTiles) {
                let dirs = [
                    [0, 1],
                    [1, 0],
                    [0, -1],
                    [-1, 0],
                    [1, 1],
                    [-1, -1],
                    [1, -1],
                    [-1, 1]
                ];
                for (let d of dirs) {
                    let nx = t.x + d[0];
                    let ny = t.y + d[1];
                    if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) {
                        let key = `${nx},${ny}`;
                        if (!visited.has(key)) {
                            visited.add(key);
                            let nTile = state.worldMap[ny][nx];
                            if (nTile.type !== 'deep_water' && nTile.type !== 'water' && !nTile.influencedBy) {
                                let distSq = Math.pow(nx - cx, 2) + Math.pow(ny - cy, 2);
                                let score = (getTileMovementCost(nx, ny) * 5) + (distSq * 5);
                                if (nTile.resourceId) score -= 200;
                                candidates.push({
                                    x: nx,
                                    y: ny,
                                    score: score
                                });
                            }
                        }
                    }
                }
            }

            if (candidates.length > 0) {
                candidates.sort((a, b) => a.score - b.score);
                let chosen = candidates[0];
                s.influencedTiles.push({
                    x: chosen.x,
                    y: chosen.y
                });
                state.worldMap[chosen.y][chosen.x].influencedBy = s.id;
                let centerTile = state.worldMap[s.tiles[0].y][s.tiles[0].x];
                if (centerTile.nationId && !state.worldMap[chosen.y][chosen.x].nationId) state.worldMap[chosen.y][chosen.x].nationId = centerTile.nationId;
                return true;
            }
            return false;
        }

        function processCultureExpansion(s, weeks, isHistory = false) {
            if (!s.culturePoints) s.culturePoints = 0;
            if (!s.influencedTiles) {
                s.influencedTiles = [...s.tiles];
                s.tiles.forEach(t => {
                    state.worldMap[t.y][t.x].influencedBy = s.id;
                });
            }
            s.culturePoints += Math.sqrt(s.population) * weeks;
            let required = s.influencedTiles.length * 20;
            let expandedCount = 0;
            let limit = isHistory ? 100 : 5;
            const expandMultiplier = 2; // 영향 범위를 2배 확장
            while (s.culturePoints >= required && expandedCount < limit) {
                s.culturePoints -= required;
                let didExpand = false;
                for (let i = 0; i < expandMultiplier; i++) {
                    let success = expandInfluence(s);
                    if (!success) break;
                    didExpand = true;
                }
                if (!didExpand) break;
                required = s.influencedTiles.length * 20;
                expandedCount++;
            }
        }


        const FOOD_CONFIG = {
            popCapBase: 10,
            popCapPerHouse: 18,
            popCapPerHut: 12,
            popCapPerOther: 8,
            farmProdPerSize: 2.0,
            herbRackProd: 3,
            consumptionPerPop: 0.6,
            storageBase: 50,
            storagePerSize: 20
        };

        const FOOD_TILE_YIELD = {
            grass: 0.6,
            forest: 0.4,
            jungle: 0.45,
            swamp: 0.25,
            lake: 0.5,
            oasis: 0.8,
            shallows: 0.4,
            coral_reef: 0.35,
            water: 0.15,
            deep_water: 0.05,
            sand: 0.12,
            snow: 0.08,
            tundra: 0.1,
            mountain: 0.05,
            volcano: 0.03,
            canyon: 0.05,
            world_tree: 0.9
        };

        const HOSTILE_BAND_TYPES = {
            bandits: {
                id: 'bandits',
                name: '도적떼',
                icon: '🗡️',
                preferredTerrains: ['grass', 'forest', 'sand', 'tundra'],
                roadBias: 1.8,
                cityBias: 1.35
            },
            goblins: {
                id: 'goblins',
                name: '고블린 무리',
                icon: '👺',
                preferredTerrains: ['forest', 'jungle', 'swamp', 'tundra'],
                roadBias: 0.85,
                cityBias: 0.75
            }
        };

        function ensureHostileBandState() {
            if (!state.hostileBands) state.hostileBands = [];
            if (!state.counters) state.counters = {};
            if (typeof state.counters.hostileBand === 'undefined') state.counters.hostileBand = 1;
        }

        function getSettlementSecurityScore(s) {
            if (!s) return 35;
            const tierBonus = {
                camp: 0,
                village: 7,
                town: 14,
                city: 22,
                metropolis: 30
            };
            let score = 20 + (tierBonus[s.type] || 0);
            const buildings = s.buildings || [];
            if (buildings.includes('guardhouse')) score += 14;
            if (buildings.includes('castle')) score += 10;
            if (buildings.includes('manor')) score += 6;
            if (buildings.includes('training_ground')) score += 5;
            score += Math.min(20, Math.floor((s.population || 0) / 70));
            return Math.max(5, Math.min(95, score));
        }

        function updateSettlementSecurityScores() {
            state.settlements.forEach(s => {
                s.security = getSettlementSecurityScore(s);
            });
        }

        function isHostileBandPassableTile(tile) {
            if (!tile) return false;
            return tile.type !== 'deep_water' && tile.type !== 'water';
        }

        function getNearestSettlementDist(x, y) {
            let minDist = Infinity;
            state.settlements.forEach(s => {
                if (!s.tiles || s.tiles.length === 0) return;
                const c = s.tiles[0];
                const d = Math.abs(c.x - x) + Math.abs(c.y - y);
                if (d < minDist) minDist = d;
            });
            return minDist;
        }

        function getNearestRoadDist(x, y, maxRadius = 7) {
            for (let r = 0; r <= maxRadius; r++) {
                for (let dy = -r; dy <= r; dy++) {
                    const remain = r - Math.abs(dy);
                    const xs = [x - remain, x + remain];
                    for (let i = 0; i < xs.length; i++) {
                        const nx = xs[i];
                        const ny = y + dy;
                        if (nx < 0 || nx >= MAP_SIZE || ny < 0 || ny >= MAP_SIZE) continue;
                        if (state.worldMap[ny][nx].hasRoad) return r;
                    }
                }
            }
            return maxRadius + 1;
        }

        function calcHostileBandSpawnWeight(settlement, tile, bandType) {
            if (!settlement || !tile || !bandType) return 0;
            if (!isHostileBandPassableTile(tile) || tile.settlementId) return 0;

            const center = settlement.tiles[0];
            const dist = Math.abs(tile.x - center.x) + Math.abs(tile.y - center.y);
            const security = Math.max(5, settlement.security || 35);
            const distWeight = 0.3 + Math.min(1.8, dist / 4);
            const securityWeight = Math.max(0.15, 1 - (security / 120));
            const roadDist = getNearestRoadDist(tile.x, tile.y);
            const roadWeight = Math.max(0.45, 1.35 - (roadDist * 0.12));
            const nearestCityDist = getNearestSettlementDist(tile.x, tile.y);
            const cityWeight = Math.max(0.45, 1.45 - (Math.max(0, 6 - nearestCityDist) * 0.12));
            const terrainWeight = bandType.preferredTerrains.includes(tile.type) ? 1.2 : 0.7;
            return distWeight * securityWeight * roadWeight * cityWeight * terrainWeight * bandType.roadBias * bandType.cityBias;
        }

        function calcGlobalHostileBandSpawnWeight(tile, bandType) {
            if (!tile || !bandType) return 0;
            if (!isHostileBandPassableTile(tile) || tile.settlementId) return 0;

            const roadDist = getNearestRoadDist(tile.x, tile.y);
            const roadWeight = Math.max(0.4, 1.4 - (roadDist * 0.14));
            const nearestCityDist = getNearestSettlementDist(tile.x, tile.y);
            const cityWeight = Math.max(0.5, 1.4 - (Math.max(0, 7 - nearestCityDist) * 0.12));
            const terrainWeight = bandType.preferredTerrains.includes(tile.type) ? 1.15 : 0.75;

            let influenceSuppression = 1.0;
            if (tile.influencedBy) {
                const owner = state.settlements.find(s => s.id === tile.influencedBy);
                if (owner && owner.tiles && owner.tiles.length > 0) {
                    const center = owner.tiles[0];
                    const dist = Math.abs(center.x - tile.x) + Math.abs(center.y - tile.y);
                    const security = Math.max(5, owner.security || getSettlementSecurityScore(owner));
                    const nearCityPenalty = Math.max(0.2, Math.min(1.0, dist / 6));
                    const securityPenalty = Math.max(0.2, 1 - (security / 110));
                    influenceSuppression = nearCityPenalty * securityPenalty;
                } else {
                    influenceSuppression = 0.65;
                }
            }

            return roadWeight * cityWeight * terrainWeight * influenceSuppression * bandType.roadBias * bandType.cityBias;
        }

        function isHostileBandDebugModeOn() {
            if (typeof ENABLE_DEBUG_TOOL === 'undefined' || !ENABLE_DEBUG_TOOL) return false;
            const floatingTool = document.getElementById('floating-debug-tool');
            if (floatingTool && !floatingTool.classList.contains('hidden')) return true;
            const debugModal = document.getElementById('debug-modal');
            if (debugModal && !debugModal.classList.contains('hidden')) return true;
            return false;
        }

        function spawnHostileBands() {
            ensureHostileBandState();
            updateSettlementSecurityScores();
            if (!state.worldMap) return;
            const cap = Math.max(6, Math.floor(state.settlements.length * 1.5));
            const needed = cap - state.hostileBands.length;
            if (needed <= 0) return;

            const spawnCount = Math.min(2, needed);
            for (let i = 0; i < spawnCount; i++) {
                const typeKey = Math.random() < 0.65 ? 'bandits' : 'goblins';
                const bandType = HOSTILE_BAND_TYPES[typeKey];
                const weightedCandidates = [];

                const sampledTiles = Math.min(220, MAP_SIZE * MAP_SIZE);
                for (let s = 0; s < sampledTiles; s++) {
                    const x = Math.floor(Math.random() * MAP_SIZE);
                    const y = Math.floor(Math.random() * MAP_SIZE);
                    const tile = state.worldMap[y][x];
                    const weight = calcGlobalHostileBandSpawnWeight(tile, bandType);
                    if (weight > 0.03) {
                        weightedCandidates.push({
                            x: tile.x,
                            y: tile.y,
                            settlementId: tile.influencedBy || null,
                            weight
                        });
                    }
                }

                if (weightedCandidates.length === 0) continue;
                let totalWeight = weightedCandidates.reduce((sum, c) => sum + c.weight, 0);
                let roll = Math.random() * totalWeight;
                let chosen = weightedCandidates[0];
                for (let j = 0; j < weightedCandidates.length; j++) {
                    roll -= weightedCandidates[j].weight;
                    if (roll <= 0) {
                        chosen = weightedCandidates[j];
                        break;
                    }
                }

                const spawnTile = state.worldMap[chosen.y][chosen.x];
                if (!spawnTile) continue;
                const overlap = state.hostileBands.find(b => b.x === chosen.x && b.y === chosen.y);
                if (overlap) continue;

                state.hostileBands.push({
                    id: `hb_${state.counters.hostileBand++}`,
                    typeId: bandType.id,
                    name: bandType.name,
                    icon: bandType.icon,
                    x: chosen.x,
                    y: chosen.y,
                    originSettlementId: chosen.settlementId,
                    threat: Math.floor(Math.random() * 5) + 1
                });
            }
        }

        function moveHostileBands() {
            ensureHostileBandState();
            if (!state.hostileBands || state.hostileBands.length === 0) return;
            const occupied = new Set();

            state.hostileBands.forEach(b => {
                const type = HOSTILE_BAND_TYPES[b.typeId] || HOSTILE_BAND_TYPES.bandits;
                const dirs = [
                    [0, 0],
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1],
                    [1, 1],
                    [-1, -1],
                    [1, -1],
                    [-1, 1]
                ];
                let best = { x: b.x, y: b.y, score: -Infinity };
                dirs.forEach(d => {
                    const nx = b.x + d[0];
                    const ny = b.y + d[1];
                    if (nx < 0 || nx >= MAP_SIZE || ny < 0 || ny >= MAP_SIZE) return;
                    const tile = state.worldMap[ny][nx];
                    if (!isHostileBandPassableTile(tile) || tile.settlementId) return;
                    const key = `${nx},${ny}`;
                    if (occupied.has(key)) return;

                    let score = Math.random() * 0.4;
                    if (type.preferredTerrains.includes(tile.type)) score += 0.7;
                    if (tile.hasRoad) score += (b.typeId === 'bandits') ? 0.9 : 0.1;
                    const nearSettlement = getNearestSettlementDist(nx, ny);
                    if (b.typeId === 'bandits') score += Math.max(0, 1.2 - (nearSettlement * 0.15));
                    else score += Math.min(0.8, nearSettlement * 0.08);
                    if (d[0] === 0 && d[1] === 0) score += 0.08;
                    if (score > best.score) best = { x: nx, y: ny, score };
                });

                b.x = best.x;
                b.y = best.y;
                occupied.add(`${b.x},${b.y}`);

                if (state.player && state.player.location && state.player.location.x === b.x && state.player.location.y === b.y) {
                    showToast(`⚠️ ${b.name}와 조우했습니다!`);
                    addTurnLog(`[위협 조우] ${b.icon} <span class="text-rose-300 font-bold">${b.name}</span>가 길목에 출몰했습니다.`);
                }
            });
        }

        function getTileFoodYield(tileType) {
            return (FOOD_TILE_YIELD[tileType] !== undefined) ? FOOD_TILE_YIELD[tileType] : 0.2;
        }

        function getSettlementBuildingStats(s) {
            let stats = {
                houseCount: 0,
                hutCount: 0,
                farmCount: 0,
                farmSize: 0,
                herbRackCount: 0,
                storageSize: 0,
                otherCount: 0
            };

            if (s.layoutData && s.layoutData.instances) {
                s.layoutData.instances.forEach(inst => {
                    if (inst.type === 'house') {
                        stats.houseCount++;
                        return;
                    }
                    if (inst.type === 'hut') {
                        stats.hutCount++;
                        return;
                    }
                    stats.otherCount++;
                    if (inst.type === 'farm') {
                        stats.farmCount++;
                        stats.farmSize += inst.sizeBonus || 9;
                    } else if (inst.type === 'herb_rack') {
                        stats.herbRackCount++;
                    } else if (inst.type === 'storage') {
                        stats.storageSize += inst.sizeBonus || 6;
                    }
                });
                return stats;
            }

            if (s.buildings && s.buildings.length > 0) {
                s.buildings.forEach(id => {
                    if (id === 'house') {
                        stats.houseCount++;
                        return;
                    }
                    if (id === 'hut') {
                        stats.hutCount++;
                        return;
                    }
                    stats.otherCount++;
                    if (id === 'farm') {
                        stats.farmCount++;
                        const size = BUILDINGS['farm'] ? (BUILDINGS['farm'].w * BUILDINGS['farm'].h) : 9;
                        stats.farmSize += size;
                    } else if (id === 'herb_rack') {
                        stats.herbRackCount++;
                    } else if (id === 'storage') {
                        const size = BUILDINGS['storage'] ? (BUILDINGS['storage'].w * BUILDINGS['storage'].h) : 6;
                        stats.storageSize += size;
                    }
                });
            }

            return stats;
        }

        function computeSettlementPopCap(stats) {
            return Math.max(
                FOOD_CONFIG.popCapBase,
                FOOD_CONFIG.popCapBase +
                (stats.houseCount * FOOD_CONFIG.popCapPerHouse) +
                (stats.hutCount * FOOD_CONFIG.popCapPerHut) +
                (stats.otherCount * FOOD_CONFIG.popCapPerOther)
            );
        }

        function computeSettlementFoodCap(stats) {
            return Math.max(
                FOOD_CONFIG.storageBase,
                Math.floor(FOOD_CONFIG.storageBase + (stats.storageSize * FOOD_CONFIG.storagePerSize))
            );
        }

        function computeSettlementFoodProduction(s, stats) {
            let production = 0;
            if (stats.farmSize > 0) production += stats.farmSize * FOOD_CONFIG.farmProdPerSize;
            if (stats.herbRackCount > 0) production += stats.herbRackCount * FOOD_CONFIG.herbRackProd;

            let tiles = s.influencedTiles && s.influencedTiles.length > 0 ? s.influencedTiles : (s.tiles || []);
            for (let t of tiles) {
                if (!state.worldMap[t.y] || !state.worldMap[t.y][t.x]) continue;
                production += getTileFoodYield(state.worldMap[t.y][t.x].type);
            }
            return production;
        }

        function updateSettlementFoodAndPopulation(s, weeks = 1, isHistory = false, modifiers = null) {
            if (!s) return;
            if (!s.influencedTiles) {
                s.influencedTiles = [...s.tiles];
                s.tiles.forEach(t => {
                    state.worldMap[t.y][t.x].influencedBy = s.id;
                });
            }

            const stats = getSettlementBuildingStats(s);
            s.popCap = computeSettlementPopCap(stats);
            s.foodCap = computeSettlementFoodCap(stats);

            let production = computeSettlementFoodProduction(s, stats) * weeks;
            let consumption = (s.population || 0) * FOOD_CONFIG.consumptionPerPop * weeks;

            if (modifiers) {
                if (typeof modifiers.foodMultiplier === 'number') production *= modifiers.foodMultiplier;
                if (typeof modifiers.consumptionMultiplier === 'number') consumption *= modifiers.consumptionMultiplier;
            }

            if (s.food === undefined || s.food === null) {
                s.food = Math.min(s.foodCap, production * 0.5);
            }

            const available = s.food + production;
            const consumed = Math.min(available, consumption);
            const shortage = consumption - consumed;
            s.food = Math.min(s.foodCap, Math.max(0, available - consumed));
            s.foodProduction = production / weeks;
            s.foodConsumption = consumption / weeks;

            if (shortage <= 0) {
                let rate = Math.random() * (isHistory ? 0.02 : 0.01) * weeks;
                let growth = Math.floor((s.population || 0) * rate);
                if (growth === 0 && (s.population || 0) > 0 && (s.population || 0) < s.popCap && Math.random() < 0.3) {
                    growth = 1;
                }
                if (growth > 0 && (s.population || 0) < s.popCap) {
                    s.population = Math.min(s.popCap, (s.population || 0) + growth);
                }
            } else {
                let shortageRatio = shortage / Math.max(consumption, 1);
                let baseDecline = 0.02 + (shortageRatio * 0.25);
                let declineRate = isHistory ? Math.min(0.6, baseDecline * weeks) : Math.min(0.35, baseDecline);
                let decline = Math.max(1, Math.floor((s.population || 0) * declineRate));
                s.population = Math.max(0, (s.population || 0) - decline);
            }

            if (modifiers && typeof modifiers.popLossRate === 'number' && modifiers.popLossRate > 0) {
                let loss = Math.max(1, Math.floor((s.population || 0) * modifiers.popLossRate));
                s.population = Math.max(0, (s.population || 0) - loss);
            }

            if (s.popCap && s.population > s.popCap) s.population = s.popCap;
        }

        function processEntityActionStep(ent, apAmount) {
            if (!ent.actionQueue || ent.actionQueue.length === 0) return;
            ent.apPool = (ent.apPool || 0) + apAmount;

            while (ent.apPool > 0 && ent.actionQueue.length > 0) {
                let act = ent.actionQueue[0];

                if (act.type === 'travel') {
                    if (act.path.length > 0) {
                        let nextNode = act.path[0];
                        let cost = act.partialCost || getTileMovementCost(nextNode.x, nextNode.y);
                        if (ent.apPool >= cost) {
                            let usedAp = cost;
                            ent.apPool -= usedAp;
                            act.remainingCost -= usedAp;
                            if (act.remainingCost < 0) act.remainingCost = 0;
                            act.remainingCost = Math.round(act.remainingCost * 10) / 10;

                            ent.location = {
                                x: nextNode.x,
                                y: nextNode.y
                            };
                            if (ent === state.player) {
                                if (!state.player.movementHistory) state.player.movementHistory = [];
                                state.player.movementHistory.push({
                                    x: nextNode.x,
                                    y: nextNode.y
                                });
                            }

                            act.path.shift();
                            delete act.partialCost;
                            if (act.path.length === 0) {
                                if (ent === state.player) showToast(`목적지에 도착했습니다.`);
                                else addTurnLog(`[이동 완료] <span class="text-blue-400 font-bold cursor-pointer hover:underline clickable-npc" data-npc-id="${ent.id}">${ent.name}</span>이(가) 목적지인 ${state.worldMap[ent.location.y][ent.location.x].name} 지역에 도착했습니다.`);
                                ent.actionQueue.shift();
                            }
                        } else {
                            let usedAp = ent.apPool;
                            act.partialCost = cost - usedAp;
                            act.remainingCost -= usedAp;
                            if (act.remainingCost < 0) act.remainingCost = 0;
                            act.remainingCost = Math.round(act.remainingCost * 10) / 10;
                            ent.apPool = 0;
                        }
                    } else {
                        ent.actionQueue.shift();
                    }
                } else if (act.type === 'interact') {
                    if (ent.apPool >= act.remainingCost) {
                        ent.apPool -= act.remainingCost;

                        if (act.statUp) {
                            if (act.statUp === 'str') ent.addedStats.str += 1;
                            else if (act.statUp === 'mag') ent.addedStats.mag += 1;
                            else if (act.statUp === 'agi') ent.addedStats.agi += 1;
                            else if (act.statUp === 'cha') ent.addedStats.cha += 1;
                            if (ent.finalStats) ent.finalStats[act.statUp] += 1;
                        }
                        if (act.getGold) {
                            ent.gold += act.getGold;
                        }

                        if (ent === state.player) showToast(`[행동 완료] ${act.name}`);
                        else {
                            if (ent.ambition && ent.ambition.type !== 'peaceful' && Math.random() < 0.2) {
                                addTurnLog(`[야망 행동] <span class="text-blue-400 font-bold cursor-pointer hover:underline clickable-npc" data-npc-id="${ent.id}">${ent.name}</span>이(가) 자신의 숙원(${AMBITIONS[ent.ambition.type].name})을 위해 [${act.name}]을(를) 완수했습니다.`);
                            }
                        }
                        ent.actionQueue.shift();
                    } else {
                        act.remainingCost -= ent.apPool;
                        ent.apPool = 0;
                    }
                }
            }
        }

        function processNPCAI(npc) {
            if (!npc.actionQueue) npc.actionQueue = [];

            // 큐가 비어있으면 남은 AP에 맞춰 새로운 행동을 채워넣음
            if (npc.actionQueue.length === 0 && npc.location) {

                // 1. 야망에 따른 다른 지역으로의 이동(Travel) 확률 로직
                let willMove = npc.ambition && npc.ambition.type !== 'peaceful' && Math.random() < 0.1;
                if (willMove) {
                    let targetLoc = null;
                    let actionName = '이동';

                    if (npc.ambition && npc.ambition.type !== 'peaceful') {
                        if (npc.ambition.type === 'revenge' && npc.ambition.targetId) {
                            let targetNPC = state.npcs.find(n => n.id === npc.ambition.targetId);
                            if (targetNPC && targetNPC.location) {
                                targetLoc = targetNPC.location;
                                actionName = '원수 추적';
                            }
                        } else if (npc.ambition.type === 'knowledge') {
                            let targets = state.settlements.filter(s => s.buildings.includes('library') || s.buildings.includes('mage_tower'));
                            if (targets.length > 0) targetLoc = targets[Math.floor(Math.random() * targets.length)].tiles[0];
                            actionName = '지식 탐구 여행';
                        } else if (npc.ambition.type === 'sword_master') {
                            let targets = state.settlements.filter(s => s.buildings.includes('dojo') || s.buildings.includes('arena') || s.buildings.includes('training_ground'));
                            if (targets.length > 0) targetLoc = targets[Math.floor(Math.random() * targets.length)].tiles[0];
                            actionName = '무사 수행';
                        } else if (npc.ambition.type === 'wealth') {
                            let targets = state.settlements.filter(s => s.buildings.includes('market') || s.buildings.includes('bank') || s.buildings.includes('guild_office'));
                            if (targets.length > 0) targetLoc = targets[Math.floor(Math.random() * targets.length)].tiles[0];
                            actionName = '거상 방문 및 상행위';
                        } else if (npc.ambition.type === 'world_conquest') {
                            let targets = state.settlements.filter(s => s.type === 'metropolis' || s.type === 'city' || s.buildings.includes('castle') || s.buildings.includes('manor'));
                            if (targets.length > 0) targetLoc = targets[Math.floor(Math.random() * targets.length)].tiles[0];
                            actionName = '권력의 중심지로 이동';
                        }

                        if (targetLoc && (targetLoc.x !== npc.location.x || targetLoc.y !== npc.location.y)) {
                            let dist = Math.abs(targetLoc.x - npc.location.x) + Math.abs(targetLoc.y - npc.location.y);
                            if (dist > 0 && dist < 50) {
                                let pathResult = calculatePathAStar(npc.location.x, npc.location.y, targetLoc.x, targetLoc.y, false);
                                if (pathResult && pathResult.path.length > 0) {
                                    npc.actionQueue.push({
                                        id: 'npc_act_' + Date.now(),
                                        type: 'travel',
                                        name: actionName,
                                        cost: pathResult.cost,
                                        remainingCost: pathResult.cost, // 이동 코스트는 거리에 비례
                                        path: pathResult.path
                                    });
                                    addTurnLog(`[여정 시작] <span class="text-blue-400 font-bold cursor-pointer hover:underline clickable-npc" data-npc-id="${npc.id}">${npc.name}</span>이(가) 자신의 숙원(${AMBITIONS[npc.ambition.type].name})을 위해 [${actionName}]을(를) 떠납니다.`);
                                    return; // 이동을 시작하면 이번 행동 할당은 끝
                                }
                            }
                        }
                    }
                }

                // 이동을 안했다면 야생 방황 로직 (낮은 확률)
                let tile = state.worldMap[npc.location.y][npc.location.x];

                // 특별한 이유가 없으면 거점(도시/마을) 방문을 선호
                if (!tile.settlementId && state.settlements.length > 0) {
                    let best = null;
                    let bestScore = Infinity;
                    for (let i = 0; i < state.settlements.length; i++) {
                        const s = state.settlements[i];
                        if (!s.tiles || s.tiles.length === 0) continue;
                        const target = s.tiles[0];
                        const dist = Math.abs(target.x - npc.location.x) + Math.abs(target.y - npc.location.y);
                        if (dist === 0 || dist > 50) continue;
                        const tierWeight = Math.max(1, getSettlementTierRank(s.type) + 1);
                        const score = dist / tierWeight;
                        if (score < bestScore) {
                            bestScore = score;
                            best = target;
                        }
                    }
                    if (best) {
                        const pathResult = calculatePathAStar(npc.location.x, npc.location.y, best.x, best.y, false);
                        if (pathResult && pathResult.path.length > 0) {
                            npc.actionQueue.push({
                                id: 'npc_act_' + Date.now(),
                                type: 'travel',
                                name: '거점 방문',
                                cost: pathResult.cost,
                                remainingCost: pathResult.cost,
                                path: pathResult.path
                            });
                            return;
                        }
                    }
                }
                // 2. 현재 마을/영지의 건물을 파악하여 상호작용 행동 큐 등록
                let possibleActions = [];

                if (tile.settlementId) {
                    let s = state.settlements.find(sett => sett.id === tile.settlementId);
                    if (s && s.buildings) {
                        s.buildings.forEach(bId => {
                            if (FACILITY_ACTIONS[bId]) {
                                possibleActions = possibleActions.concat(FACILITY_ACTIONS[bId]);
                            }
                        });
                    }
                }

                // 💡 [추가] NPC가 던전이 있는 타일에 서있다면, 던전 탐험을 행동 후보에 추가
                if (tile.dungeonId) {
                    let dungeon = state.dungeons.find(d => d.id === tile.dungeonId);
                    if (dungeon && !dungeon.cleared) {
                        // 야망이 '세계 제일의 검사'이거나 '재력가'인 NPC는 던전 탐험 확률이 매우 높아지도록 가중치 부여용 statUp, getGold 추가
                        possibleActions.push({
                            name: `[던전 탐험] ${dungeon.name}`,
                            cost: 4,
                            icon: '⚔️',
                            statUp: 'str',
                            getGold: 30
                        });
                        possibleActions.push({
                            name: `[던전 탐험] ${dungeon.name}`,
                            cost: 4,
                            icon: '🛡️',
                            statUp: 'agi',
                            getGold: 30
                        });
                    }
                }


                // AP가 소모되는 행동만 필터링
                let validActions = possibleActions.filter(a => a.cost > 0 && (a.reqAdult === undefined || a.reqAdult === state.adultMode));

                let pickedAction;
                if (validActions.length === 0) {
                    // 마을이 아니거나 할 게 없으면 기본 휴식
                    pickedAction = {
                        name: '야영 및 모닥불 휴식',
                        cost: 3,
                        type: 'interact'
                    };
                } else {
                    pickedAction = validActions[Math.floor(Math.random() * validActions.length)];

                    // 야망이 있다면 야망에 맞는 스탯업/수익 창출 건물을 찾아 가중치를 둠
                    if (npc.ambition) {
                        let preferredStat = null;
                        if (npc.ambition.type === 'sword_master') preferredStat = 'str';
                        else if (npc.ambition.type === 'world_conquest') preferredStat = 'cha';
                        else if (npc.ambition.type === 'knowledge') preferredStat = 'mag';
                        else if (npc.ambition.type === 'revenge') preferredStat = 'agi';

                        if (preferredStat) {
                            let prefActs = validActions.filter(a => a.statUp === preferredStat);
                            if (prefActs.length > 0 && Math.random() < 0.6) {
                                pickedAction = prefActs[Math.floor(Math.random() * prefActs.length)];
                            }
                        } else if (npc.ambition.type === 'wealth') {
                            let goldActs = validActions.filter(a => a.getGold);
                            if (goldActs.length > 0 && Math.random() < 0.6) {
                                pickedAction = goldActs[Math.floor(Math.random() * goldActs.length)];
                            }
                        }
                    }
                }

                // 뽑은 행동을 큐에 삽입 (NPC의 AP가 허락하는 한 1턴에 여러 번 호출됨)
                npc.actionQueue.push({
                    id: 'npc_rest_' + Date.now() + Math.random(),
                    type: 'interact',
                    name: pickedAction.name,
                    cost: pickedAction.cost,
                    remainingCost: pickedAction.cost,
                    statUp: pickedAction.statUp,
                    getGold: pickedAction.getGold
                });
            }
        }

        function triggerNPCAmbitionEvents() {
            state.npcs.forEach(npc => {
                if (Math.random() < 0.002) {
                    let eventRoll = Math.random();
                    let oldType = npc.ambition ? npc.ambition.type : 'peaceful';

                    if (eventRoll < 0.2 && state.npcs.length > 1) {
                        let target = state.npcs[Math.floor(Math.random() * state.npcs.length)];
                        if (target.id !== npc.id && oldType !== 'revenge') {
                            npc.ambition = {
                                type: 'revenge',
                                targetId: target.id
                            };
                            addTurnLog(`[운명의 전환] <span class="text-blue-400 font-bold cursor-pointer hover:underline clickable-npc" data-npc-id="${npc.id}">${npc.name}</span>의 가족이 비극적인 죽음을 맞이했습니다. 숙원이 <span class="text-rose-400 font-bold">[피의 복수]</span>로 변경되었습니다.`);
                        }
                    } else if (eventRoll < 0.4 && oldType !== 'knowledge') {
                        npc.ambition = {
                            type: 'knowledge'
                        };
                        addTurnLog(`[운명의 전환] <span class="text-blue-400 font-bold cursor-pointer hover:underline clickable-npc" data-npc-id="${npc.id}">${npc.name}</span>이(가) 고대 유적에서 잊혀진 문헌을 발견했습니다. 숙원이 <span class="text-purple-400 font-bold">[진리의 탐구자]</span>로 변경되었습니다.`);
                    } else if (eventRoll < 0.6 && oldType !== 'wealth') {
                        npc.ambition = {
                            type: 'wealth'
                        };
                        addTurnLog(`[운명의 전환] <span class="text-blue-400 font-bold cursor-pointer hover:underline clickable-npc" data-npc-id="${npc.id}">${npc.name}</span>이(가) 거대한 상단과 접촉하여 돈의 맛을 알았습니다. 숙원이 <span class="text-yellow-400 font-bold">[대륙의 거부]</span>로 변경되었습니다.`);
                    } else if (eventRoll < 0.8 && oldType !== 'sword_master') {
                        npc.ambition = {
                            type: 'sword_master'
                        };
                        addTurnLog(`[운명의 전환] <span class="text-blue-400 font-bold cursor-pointer hover:underline clickable-npc" data-npc-id="${npc.id}">${npc.name}</span>이(가) 압도적인 강자의 전투를 목격했습니다. 숙원이 <span class="text-emerald-400 font-bold">[세계 제일의 검사]</span>로 변경되었습니다.`);
                    } else if (eventRoll >= 0.8 && oldType !== 'world_conquest') {
                        npc.ambition = {
                            type: 'world_conquest'
                        };
                        addTurnLog(`[운명의 전환] <span class="text-blue-400 font-bold cursor-pointer hover:underline clickable-npc" data-npc-id="${npc.id}">${npc.name}</span>의 내면 깊은 곳에서 지배욕이 각성했습니다! 숙원이 <span class="text-red-500 font-bold">[세계 정복]</span>으로 변경되었습니다.`);
                    }
                }
            });
        }

        function processTurnExecution() {
            if (state.isAnimating) return;
            ensureEntityLifeState(state.player);
            if (state.player.isDead) {
                showToast('사망한 상태에서는 턴을 진행할 수 없습니다.');
                return;
            }

            if (!state.turnLogs) state.turnLogs = [];
            const calInfo = getCalendarInfo(state.gameDate);
            state.turnLogs.unshift({
                title: `${state.gameDate.year}년 ${state.gameDate.month}월 ${state.gameDate.week}주차 [${calInfo.weekName}]`,
                logs: []
            });

            state.player.movementHistory = [{
                x: state.player.location.x,
                y: state.player.location.y
            }];

            for (let apStep = 1; apStep <= TURN_AP; apStep++) {
                processEntityActionStep(state.player, 1);
                state.npcs.forEach(npc => {
                    processNPCAI(npc);
                    processEntityActionStep(npc, 1);
                });
            }

            state.player.apPool = 0;
            state.npcs.forEach(npc => npc.apPool = 0);

            const prevYear = state.gameDate.year;
            state.gameDate.week++;
            if (state.gameDate.week > 4) {
                state.gameDate.week = 1;
                state.gameDate.month++;
                if (state.gameDate.month > 12) {
                    state.gameDate.month = 1;
                    state.gameDate.year++;
                }
            }
            if (state.gameDate.year > prevYear) {
                state.player.age = (parseInt(state.player.age, 10) || 0) + 1;
                state.npcs.forEach(npc => {
                    npc.age = (parseInt(npc.age, 10) || 0) + 1;
                });
            }
            processAgingAndHealth();
            if (state.player.originType === 'isekai' && state.player.ip < 100) state.player.ip = Math.min(100, state.player.ip + 5);
            if (state.player.originType === 'possession' && state.player.pp < 100) state.player.pp = Math.min(100, state.player.pp + 5);

            state.settlements.forEach(s => {
                updateSettlementFoodAndPopulation(s, 1, false);
                checkSettlementUpgrades(s);
                processCultureExpansion(s, 1, false);
                foundNationFromSettlement(s, false);
            });
            updateSettlementSecurityScores();
            updateSettlementInfluences();
            updateNationBordersFromInfluence();
            spawnHostileBands();
            moveHostileBands();
            triggerNPCAmbitionEvents();
            renderActionQueueBar();

            // 💡 마나와 관계 시뮬레이션을 화면 그리기(렌더링) 이전에 먼저 실행하도록 순서 수정!
            simulateRelationships();
            simulateManaFlow();

            if (state.player.movementHistory && state.player.movementHistory.length > 1) {
                state.inGameTab = 'map';
                updateInGameOverlay(false);
                animatePlayerMovement(() => finalizeTurnExecution());
            } else {
                finalizeTurnExecution();
            }
        }

        // ==========================================
        // 3-1. 호감도 및 관계 처리 시뮬레이션
        // ==========================================

        function addFavorability(charA, charB, amount) {
            if (!charA || !charB || charA.id === charB.id) return;

            if (!charA.relationships) charA.relationships = {};
            if (!charB.relationships) charB.relationships = {};

            if (charA.relationships[charB.id] === undefined) charA.relationships[charB.id] = 0;
            if (charB.relationships[charA.id] === undefined) charB.relationships[charA.id] = 0;

            charA.relationships[charB.id] += amount;
            charB.relationships[charA.id] += amount;

            charA.relationships[charB.id] = Math.max(-100, Math.min(100, charA.relationships[charB.id]));
            charB.relationships[charA.id] = Math.max(-100, Math.min(100, charB.relationships[charA.id]));
        }

        // 💡 [복구됨] 이 함수가 누락되어 턴 종료 시 에러가 발생하고 마나 흐름이 작동하지 않았습니다.
        function simulateRelationships() {
            let locationGroups = {};
            const addEntity = (ent) => {
                if (!ent.location) return;
                let key = `${ent.location.x},${ent.location.y}`;
                if (!locationGroups[key]) locationGroups[key] = [];
                locationGroups[key].push(ent);
            };
            addEntity(state.player);
            state.npcs.forEach(addEntity);

            for (let key in locationGroups) {
                let group = locationGroups[key];
                if (group.length > 1) {
                    let interactions = Math.floor(group.length / 2);
                    for (let i = 0; i < interactions; i++) {
                        let a = group[Math.floor(Math.random() * group.length)];
                        let b = group[Math.floor(Math.random() * group.length)];
                        if (a.id !== b.id) {
                            let favorChange = Math.random() < 0.8 ? (Math.floor(Math.random() * 2) + 1) : -1;
                            addFavorability(a, b, favorChange);
                        }
                    }
                }
            }

            const isAdult = (ent) => ent && !ent.isDead && (ent.age >= getAdultAge(ent.race));
            const isFertileFemale = (ent) => {
                if (!ent || ent.gender !== 'F' || ent.isDead || ent.pregnancy) return false;
                const adultAge = getAdultAge(ent.race);
                const fertileEnd = Math.max(adultAge + 1, getOldAgeStart(ent.race) - 5);
                return ent.age >= adultAge && ent.age <= fertileEnd;
            };
            const linkMarriage = (a, b) => {
                if (!a || !b || a.id === b.id) return;
                const prevA = (a.spouseId && a.spouseId !== b.id) ? state.npcs.find(n => n.id === a.spouseId) : null;
                const prevB = (b.spouseId && b.spouseId !== a.id) ? state.npcs.find(n => n.id === b.spouseId) : null;
                a.spouseId = b.id;
                b.spouseId = a.id;
                if (prevA && prevA.spouseId === a.id) prevA.spouseId = null;
                if (prevB && prevB.spouseId === b.id) prevB.spouseId = null;
            };
            const processSexAndPregnancy = (a, b) => {
                const compatibility = getSexCompatibility(a, b);
                const favor = ((a.relationships && a.relationships[b.id]) || 0);
                const spouseBonus = (a.spouseId === b.id && b.spouseId === a.id) ? 0.2 : 0;
                const sexChance = Math.min(0.95, Math.max(0.03, 0.12 + (favor / 220) + ((a.hiddenStats?.lust || 0) / 450) + spouseBonus));
                if (Math.random() >= sexChance) return;

                a.lastSexTurn = state.history.currentTurn;
                b.lastSexTurn = state.history.currentTurn;
                const satisfactionDelta = Math.max(-2, Math.floor((compatibility - 50) / 12));
                addFavorability(a, b, satisfactionDelta);

                const male = a.gender === 'M' ? a : (b.gender === 'M' ? b : null);
                const female = a.gender === 'F' ? a : (b.gender === 'F' ? b : null);
                if (!male || !female) return;
                if (male.race !== female.race) return; // 이종족 간 임신 불가
                if (!isFertileFemale(female)) return;

                const pregnancyChance = Math.min(0.12, (0.01 + (compatibility / 5000)));
                if (Math.random() < pregnancyChance) {
                    female.pregnancy = {
                        fatherId: male.id,
                        startedTurn: state.history.currentTurn
                    };
                }
            };

            // 💡 배우자 정보가 끊기거나 단방향으로 남지 않도록 정규화
            state.npcs.forEach(npc => {
                if (!npc || !npc.spouseId) return;
                const spouse = state.npcs.find(n => n.id === npc.spouseId);
                if (!spouse || spouse.isDead || npc.isDead || spouse.id === npc.id) {
                    npc.spouseId = null;
                    return;
                }
                if (spouse.spouseId !== npc.id) {
                    linkMarriage(npc, spouse);
                }
            });

            for (let key in locationGroups) {
                const group = locationGroups[key].filter(isAdult);
                if (group.length < 2) continue;
                for (let i = 0; i < group.length; i++) {
                    const a = group[i];
                    const candidates = group.filter(b => b.id !== a.id);
                    if (candidates.length === 0) continue;

                    candidates.sort((left, right) => {
                        const favorL = (a.relationships && a.relationships[left.id]) || 0;
                        const favorR = (a.relationships && a.relationships[right.id]) || 0;
                        const raceBonusL = left.race === a.race ? 22 : 0;
                        const raceBonusR = right.race === a.race ? 22 : 0;
                        return (favorR + raceBonusR + Math.random() * 12) - (favorL + raceBonusL + Math.random() * 12);
                    });
                    const b = candidates[0];
                    if (!b) continue;

                    const favor = (a.relationships && a.relationships[b.id]) || 0;
                    if (!a.spouseId && !b.spouseId && favor >= 70) {
                        const spouseChance = (a.race === b.race) ? 0.18 : 0.04;
                        if (Math.random() < spouseChance) linkMarriage(a, b);
                    }
                    processSexAndPregnancy(a, b);
                }
            }
        }

        // 💡 게임 달력에 맞춰 마나가 폭발하고 가라앉는 '맥동' 시스템 적용
        function simulateManaFlow() {
            // 💡 1단계: 마나 자생 및 자연 감소 (Temp 배열에 먼저 계산)
            let tempMana = Array(MAP_SIZE).fill(0).map(() => Array(MAP_SIZE).fill(0));

            const DECAY_RATE = 0.03;
            const MAX_MANA = 3.0;

            let waveMultiplier = 1.0;
            if (state.gameDate.week === 1) waveMultiplier = 4.0;
            else if (state.gameDate.week === 2) waveMultiplier = 1.5;
            else if (state.gameDate.week === 3) waveMultiplier = 0.2;
            else if (state.gameDate.week === 4) waveMultiplier = 0.0;

            for (let y = 0; y < MAP_SIZE; y++) {
                for (let x = 0; x < MAP_SIZE; x++) {
                    let tile = state.worldMap[y][x];
                    let currentMana = tile.mana;

                    let prod = 0;
                    if (tile.type === 'world_tree') prod = 0.8;
                    else if (tile.type === 'dragon_peak' || tile.type === 'crystal_cave' || tile.type === 'ancient_monolith') prod = 0.5;
                    else if (tile.type === 'forest' || tile.type === 'jungle' || tile.type === 'coral_reef' || tile.type === 'swamp') prod = 0.025;
                    else if (tile.type === 'lake' || tile.type === 'oasis' || tile.type === 'shallows') prod = 0.015;
                    else if (tile.type === 'grass') prod = 0.008;
                    else prod = 0.005;

                    currentMana += (prod * waveMultiplier);

                    currentMana *= (1 - DECAY_RATE);

                    if (tile.settlementId) {
                        let s = state.settlements.find(sett => sett.id === tile.settlementId);
                        if (s) {
                            if (s.buildings.includes('mage_tower')) currentMana -= 0.1;
                            currentMana -= (s.population * 0.00002);
                        }
                    }
                    tempMana[y][x] = Math.max(0, currentMana);
                }
            }

            // 💡 2단계: 농도차(Gradient) 기반 확산 설계
            // 마나는 무조건 '높은 곳에서 낮은 곳'으로만 흐릅니다.
            let nextMana = Array(MAP_SIZE).fill(0).map(() => Array(MAP_SIZE).fill(0));
            const BASE_FLOW_RATE = 0.2; // 인접한 타일과의 농도 차이 중 12%가 이동

            for (let y = 0; y < MAP_SIZE; y++) {
                for (let x = 0; x < MAP_SIZE; x++) {
                    let myMana = tempMana[y][x];
                    let totalOut = 0;

                    let dirs = [
                        [0, -1],
                        [0, 1],
                        [-1, 0],
                        [1, 0]
                    ];

                    for (let d of dirs) {
                        let nx = x + d[0];
                        let ny = y + d[1];
                        if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) {
                            let neighborMana = tempMana[ny][nx];

                            // 내 마나가 이웃보다 많을 때만 흘려보냄 (농도차 기반)
                            if (myMana > neighborMana) {
                                let diff = myMana - neighborMana;
                                let flow = diff * BASE_FLOW_RATE;

                                // 마나를 '받는' 대상(이웃 타일)의 지형에 따른 저항/가속
                                let nType = state.worldMap[ny][nx].type;
                                if (nType === 'mountain' || nType === 'volcano' || nType === 'canyon') {
                                    flow *= 1; // 험준한 바위산은 마나가 스며들기 힘듦 (강한 저항, 튕겨냄)
                                } else if (nType === 'water' || nType === 'lake' || nType === 'coral_reef' || nType === 'shallows') {
                                    flow *= 1.1; // 물은 마나를 스펀지처럼 빠르게 흡수
                                } else if (nType === 'grass') {
                                    flow *= 1.1; // 평원은 마나를 거부감 없이 잘 받아들임
                                }

                                totalOut += flow;
                                nextMana[ny][nx] += flow; // 이웃에게 마나 전달
                            }
                        }
                    }
                    // 내 타일에는 이웃에게 흘려보내고 남은 마나를 보존
                    nextMana[y][x] += (myMana - totalOut);
                }
            }

            // 💡 3단계: 최종 맵 반영
            for (let y = 0; y < MAP_SIZE; y++) {
                for (let x = 0; x < MAP_SIZE; x++) {
                    state.worldMap[y][x].mana = Math.min(MAX_MANA, nextMana[y][x]);
                }
            }
        }

        // 이동 궤적을 부드럽게 그리는 함수 (화면 강제 추적 방지)
        function animatePlayerMovement(callback) {
            state.isAnimating = true;
            const history = state.player.movementHistory;
            const totalSegments = history.length - 1;

            if (totalSegments <= 0) {
                state.isAnimating = false;
                state.animatingLocation = null;
                callback();
                return;
            }

            let startTime = null;
            const animationDuration = 1000;

            function step(timestamp) {
                if (!startTime) startTime = timestamp;
                const elapsed = timestamp - startTime;
                let t = Math.min(elapsed / animationDuration, 1.0);

                let totalProgress = t * totalSegments;
                let currentSegment = Math.floor(totalProgress);
                let segmentProgress = totalProgress - currentSegment;

                if (currentSegment >= totalSegments) {
                    currentSegment = totalSegments - 1;
                    segmentProgress = 1.0;
                }

                const p1 = history[currentSegment];
                const p2 = history[currentSegment + 1];
                const x = p1.x + (p2.x - p1.x) * segmentProgress;
                const y = p1.y + (p2.y - p1.y) * segmentProgress;

                state.animatingLocation = {
                    x,
                    y
                };
                drawPlayerOverlay();

                // 💡 애니메이션 진행 중 맵을 내 쪽으로 강제로 당기는 코드 삭제 (화면 고정 유지)

                if (t < 1.0) {
                    requestAnimationFrame(step);
                } else {
                    state.isAnimating = false;
                    state.animatingLocation = null;
                    callback();
                }
            }
            requestAnimationFrame(step);
        }

        function finalizeTurnExecution() {
            // 💡 턴 종료 시 맵 시점이 멋대로 내 위치로 돌아가지 않도록 파라미터를 false로 수정!
            if (state.inGameTab === 'map') drawCanvasMap(false);
            else updateInGameOverlay(false);

            const newCalInfo = getCalendarInfo(state.gameDate);
            const btnCalInfo = document.getElementById('btn-show-calendar-info');
            if (btnCalInfo) {
                btnCalInfo.innerHTML = `
                    <div class="text-blue-400 font-fantasy font-bold text-base md:text-lg tracking-wider leading-tight flex items-center">대륙력 ${state.gameDate.year}년 ${state.gameDate.month}월 <span class="text-slate-300 text-sm ml-1 group-hover:text-blue-300">(${newCalInfo.monthName}의 달) ℹ️</span></div>
                    <div class="text-[10px] md:text-xs text-slate-400">${newCalInfo.seasonName} / ${state.gameDate.week}주차 [${newCalInfo.weekName}의 주]</div>
                `;
            }

            const goldElem = document.getElementById('topbar-gold');
            if (goldElem) goldElem.innerText = `${state.player.gold} G`;

            const debugModal = document.getElementById('debug-modal');
            if (debugModal && !debugModal.classList.contains('hidden')) renderDebugModalContent();

            showToast("1주의 시간이 흘렀습니다. 턴 진행 완료.");

            AetheriaSaveManager.saveGame('auto').then(() => {
                console.log("Auto-saved successfully.");
            }).catch(e => {
                console.error("Auto-save failed:", e);
            });
        }

        function updateSettlementInfluences() {
            state.worldMap.forEach(row => row.forEach(t => t.influencedBy = null));
            state.settlements.forEach(s => {
                if (s.influencedTiles) {
                    s.influencedTiles.forEach(t => {
                        if (t.x >= 0 && t.x < MAP_SIZE && t.y >= 0 && t.y < MAP_SIZE) {
                            state.worldMap[t.y][t.x].influencedBy = s.id;
                        }
                    });
                }
            });
        }

        // ==========================================
        // 4. 이름, 인물 생성 및 태생 로직
        // ==========================================
        // 💡 로컬 assets에서 초상화 이미지를 가져오는 함수 (없으면 이모지 출력)
        function getPortraitHtml(race, gender, id, fallbackIcon, classes = 'w-24 h-24') {
            const baseUrl = "assets";
            const genderDir = (gender || "").toLowerCase();
            const imgUrl = `${baseUrl}/${race}/${genderDir}/${id}/face.png`;

            return `
                <div class="relative flex items-center justify-center bg-slate-800 border border-slate-600 shadow-inner overflow-hidden shrink-0 ${classes}">
                    <span class="portrait-fallback absolute text-5xl opacity-50 drop-shadow-md">${fallbackIcon}</span>
                    <img src="${imgUrl}" 
                         class="absolute inset-0 w-full h-full object-cover object-top z-10"
                         loading="eager"
                         onload="this.style.opacity=1; const fb=this.parentElement.querySelector('.portrait-fallback'); if (fb) fb.style.display='none';"
                         onerror="this.style.opacity=0; this.classList.add('hidden'); const fb=this.parentElement.querySelector('.portrait-fallback'); if (fb) fb.style.display='block';" 
                         style="opacity: 0;"
                         alt="Portrait">
                </div>
            `;
        }

        // 성인 기준 나이를 반환하는 헬퍼 함수
        function getAdultAge(race) {
            if (race === 'human') return 18;
            if (race === 'elf') return 50;
            if (race === 'dragonborn') return 20;
            if (race === 'dwarf') return 40;
            return 20;
        }

        function getOldAgeStart(race) {
            if (race === 'human') return 65;
            if (race === 'elf') return 240;
            if (race === 'dragonborn') return 180;
            if (race === 'dwarf') return 140;
            return 70;
        }

        function ensureEntityLifeState(entity) {
            if (!entity) return;
            if (typeof entity.health !== 'number' || Number.isNaN(entity.health)) entity.health = 100;
            entity.health = Math.max(0, Math.min(100, Math.floor(entity.health)));
            if (entity.isDead === undefined) entity.isDead = false;
            if (entity.health <= 0) entity.isDead = true;
            if (entity.isDead) entity.status = '사망';
        }

        function processAgingAndHealth() {
            ensureEntityLifeState(state.player);
            state.npcs.forEach(ensureEntityLifeState);

            const allEntities = [state.player, ...state.npcs];
            allEntities.forEach(ent => {
                if (ent.isDead) return;
                const oldAgeStart = getOldAgeStart(ent.race);
                if (ent.age >= oldAgeStart && Math.random() < 0.5) {
                    ent.health = Math.max(0, ent.health - 1);
                }
                if (ent.health <= 0) {
                    ent.health = 0;
                    ent.isDead = true;
                    ent.status = '사망';
                    if (ent.id === state.player.id) {
                        addTurnLog(`[노쇠] ${ent.name || '플레이어'}의 건강이 다해 사망했습니다.`);
                        showToast('플레이어가 노쇠로 사망했습니다.');
                    } else {
                        addTurnLog(`[노쇠] <span class="text-blue-400 font-bold cursor-pointer hover:underline clickable-npc" data-npc-id="${ent.id}">${ent.name}</span>의 건강이 다해 사망했습니다.`);
                    }
                }
            });

            state.npcs = state.npcs.filter(npc => !npc.isDead);
        }

        // 이름과 성씨를 분리해서 반환하도록 수정
        function generateNameParts(race, gender) {
            const rData = NAME_DATA[race] || NAME_DATA['human'];
            const gKey = (gender === 'F' || gender === 'M') ? gender : 'M';
            const firstArr = rData.first && rData.first[gKey] ? rData.first[gKey] : rData.first['M'];
            const lastArr = rData.last || [];

            const first = firstArr[Math.floor(Math.random() * firstArr.length)];
            const last = lastArr.length > 0 ? lastArr[Math.floor(Math.random() * lastArr.length)] : '';
            return { first, last };
        }

        function generateName(race, gender) {
            let parts = generateNameParts(race, gender);
            return parts.first + parts.last;
        }

        function collectUsedFullNames() {
            const used = new Set();
            if (state.player && state.player.firstName && state.player.lastName) used.add(`${state.player.firstName}|${state.player.lastName}`);
            state.npcs.forEach(npc => {
                if (!npc || !npc.firstName || !npc.lastName) return;
                used.add(`${npc.firstName}|${npc.lastName}`);
            });
            return used;
        }

        function generateUniqueNameParts(race, gender) {
            const usedNames = collectUsedFullNames();
            let parts = null;
            let guard = 0;
            do {
                parts = generateNameParts(race, gender);
                guard++;
            } while (usedNames.has(`${parts.first}|${parts.last}`) && guard < 500);
            return parts;
        }

        function generateEntitySeedCode() {
            return String(Math.floor(Math.random() * 10000000000)).padStart(10, '0');
        }

        function getSexCompatibility(a, b) {
            const aSeed = String(a?.seedCode || '0000000000');
            const bSeed = String(b?.seedCode || '0000000000');
            const aHead = parseInt(aSeed.slice(0, 2), 10) || 0;
            const bHead = parseInt(bSeed.slice(0, 2), 10) || 0;
            return Math.max(1, 100 - Math.abs(aHead - bHead));
        }

        function generateSettlementName() {
            const prefixes = SETTLEMENT_NAME_DATA.prefixes;
            const suffixes = SETTLEMENT_NAME_DATA.suffixes;
            return prefixes[Math.floor(Math.random() * prefixes.length)] + suffixes[Math.floor(Math.random() * suffixes.length)];
        }

        function generatePhysicalAndHiddenStats(race, gender) {
            let ageMin, ageMax, heightMin, heightMax, bmiMin, bmiMax;
            if (race === 'human') {
                ageMin = 18;
                ageMax = 35;
                heightMin = gender === 'M' ? 168 : 155;
                heightMax = gender === 'M' ? 188 : 172;
                bmiMin = 20;
                bmiMax = 25;
            } else if (race === 'elf') {
                ageMin = 50;
                ageMax = 200;
                heightMin = gender === 'M' ? 175 : 165;
                heightMax = gender === 'M' ? 195 : 180;
                bmiMin = 18;
                bmiMax = 22;
            } else if (race === 'dragonborn') {
                ageMin = 20;
                ageMax = 150;
                heightMin = gender === 'M' ? 185 : 175;
                heightMax = gender === 'M' ? 210 : 195;
                bmiMin = 26;
                bmiMax = 33;
            } else if (race === 'dwarf') {
                ageMin = 40;
                ageMax = 120;
                heightMin = gender === 'M' ? 140 : 135;
                heightMax = gender === 'M' ? 155 : 150;
                bmiMin = 28;
                bmiMax = 35;
            } else {
                ageMin = 20;
                ageMax = 50;
                heightMin = 160;
                heightMax = 180;
                bmiMin = 20;
                bmiMax = 25;
            } // Fallback for mod races

            const age = Math.floor(Math.random() * (ageMax - ageMin + 1)) + ageMin;
            const height = Math.floor(Math.random() * (heightMax - heightMin + 1)) + heightMin;
            const bmi = Math.random() * (bmiMax - bmiMin) + bmiMin;
            const weight = Math.floor(bmi * Math.pow(height / 100, 2));
            const aggression = Math.floor(Math.random() * 100) + 1;
            const sociability = Math.floor(Math.random() * 100) + 1;
            const ambition = Math.floor(Math.random() * 100) + 1;
            const morality = Math.floor(Math.random() * 100) + 1;
            const lust = Math.floor(Math.random() * 100) + 1;

            let pLength = 0,
                vDepth = 0,
                bust = 0,
                waist = 0,
                hip = 0;
            if (gender === 'M') {
                let baseL = race === 'dragonborn' ? 18 : race === 'human' ? 14 : race === 'elf' ? 13 : 15;
                pLength = baseL + Math.floor(Math.random() * 7) - 2 + (height > 180 ? 2 : 0);
            } else {
                let baseDepth = race === 'dragonborn' ? 16 : race === 'dwarf' ? 13 : 15;
                vDepth = baseDepth + Math.floor(Math.random() * 4) - 1;
                let b_base = race === 'dragonborn' ? 95 : race === 'elf' ? 82 : race === 'dwarf' ? 92 : 86;
                bust = b_base + Math.floor(bmi * 1.5) + Math.floor(Math.random() * 12) - 4;
                waist = 55 + Math.floor(bmi * 1.2) + Math.floor(Math.random() * 8);
                hip = b_base + 5 + Math.floor(bmi * 1.4) + Math.floor(Math.random() * 10) - 3;
            }

            let prefGender = '이성';
            let rollG = Math.random();
            if (rollG < 0.70) prefGender = '이성';
            else if (rollG < 0.85) prefGender = '동성';
            else if (rollG < 0.95) prefGender = '양성 (모두)';
            else prefGender = '무성 (관심없음)';
            let prefAge = '상관없음';
            let rollA = Math.random();
            if (rollA < 0.35) prefAge = '연상';
            else if (rollA < 0.7) prefAge = '연하';
            else if (rollA < 0.9) prefAge = '동갑 (비슷한 연령)';
            else prefAge = '상관없음';

            return {
                age,
                height,
                weight,
                hidden: {
                    pLength,
                    vDepth,
                    bust,
                    waist,
                    hip,
                    aggression,
                    sociability,
                    ambition,
                    morality,
                    lust,
                    prefGender,
                    prefAge
                }
            };
        }

        function createRandomNPC() {
            const races = Object.keys(RACES);
            const race = races[Math.floor(Math.random() * races.length)];
            const gender = Math.random() > 0.5 ? 'M' : 'F';
            const pStats = generatePhysicalAndHiddenStats(race, gender);
            const b = RACES[race].baseStats || {
                str: 50,
                mag: 50,
                agi: 50,
                cha: 50
            };
            const baseStats = {
                str: Math.max(1, Math.min(100, b.str + Math.floor(Math.random() * 20 - 10))),
                mag: Math.max(1, Math.min(100, b.mag + Math.floor(Math.random() * 20 - 10))),
                agi: Math.max(1, Math.min(100, b.agi + Math.floor(Math.random() * 20 - 10))),
                cha: Math.max(1, Math.min(100, b.cha + Math.floor(Math.random() * 20 - 10)))
            };

            const availableTraits = Object.values(TRAITS).filter(t => t.acq === 'innate' && t.tier !== '유일' && !t.reqAdult && (!t.reqGender || t.reqGender === gender));
            const traitPicked = availableTraits.length > 0 ? availableTraits[Math.floor(Math.random() * availableTraits.length)] : null;

            let ambitionType = 'peaceful';
            let ambitionTarget = null;
            let roll = Math.random();
            if (roll < 0.1) ambitionType = 'sword_master';
            else if (roll < 0.15) ambitionType = 'world_conquest';
            else if (roll < 0.25) ambitionType = 'wealth';
            else if (roll < 0.35) ambitionType = 'knowledge';
            else if (roll < 0.4 && state.npcs.length > 0) {
                ambitionType = 'revenge';
                ambitionTarget = state.npcs[Math.floor(Math.random() * state.npcs.length)].id;
            }

            const nameParts = generateUniqueNameParts(race, gender);
            const npc = {
                id: 'npc_' + state.counters.npc++,
                name: nameParts.first + nameParts.last,
                firstName: nameParts.first, // 💡 이름 분리 저장
                lastName: nameParts.last, // 💡 성씨(가문) 분리 저장
                seedCode: generateEntitySeedCode(),
                gender,
                race,
                age: pStats.age,
                health: 100,
                isDead: false,
                height: pStats.height,
                weight: pStats.weight,
                baseStats,
                traits: traitPicked ? [traitPicked.id] : [],
                addedStats: {
                    str: 0,
                    mag: 0,
                    agi: 0,
                    cha: 0
                },
                finalStats: baseStats,
                hiddenStats: pStats.hidden,
                gold: Math.floor(Math.random() * 1000),
                status: '재야',
                location: null,
                actionQueue: [],
                apPool: 0,
                relationships: {},
                spouseId: null,
                pregnancy: null,
                lastSexTurn: null,
                ambition: {
                    type: ambitionType,
                    targetId: ambitionTarget
                },
                portraitId: Math.floor(Math.random() * 30) + 1
            };
            state.npcs.push(npc);
            return npc;
        }

        function generateOrigins() {
            let choices = [];
            let hasSpecial = false;

            // 💡 각 종족의 성인 나이 + 최소 임신 가능 기간(약 15년)을 고려하여 부모 후보 필터링
            let maleAdults = state.npcs.filter(n => n.gender === 'M' && n.age >= getAdultAge(n.race) + 15);
            let femaleAdults = state.npcs.filter(n => n.gender === 'F' && n.age >= getAdultAge(n.race) + 15);

            for (let i = 0; i < 3; i++) {
                let roll = Math.random();
                if (roll < 0.25 && !hasSpecial) {
                    hasSpecial = true;
                    let spRoll = Math.random();
                    if (spRoll < 0.33) choices.push({
                        type: 'isekai',
                        title: '이세계 환생',
                        desc: '이계의 지식을 가진 채 강림합니다. [이세계 환생] 특성 고정. 모든 것을 직접 설정합니다.'
                    });
                    else if (spRoll < 0.66) choices.push({
                        type: 'regression',
                        title: '회귀자',
                        desc: '역사 속 특정 시점으로 시간을 되돌려 시작합니다. [회귀자] 특성 고정.'
                    });
                    else choices.push({
                        type: 'possession',
                        title: '빙의자',
                        desc: '현존하는 인물의 육체를 훔쳐 시작합니다. [빙의자] 특성 고정.'
                    });
                } else if (roll < 0.6 && maleAdults.length > 0 && femaleAdults.length > 0) {
                    let father = maleAdults[Math.floor(Math.random() * maleAdults.length)];
                    let sameRaceMothers = femaleAdults.filter(n => n.race === father.race);
                    if (sameRaceMothers.length === 0) {
                        choices.push({
                            type: 'orphan',
                            title: '부모 미상의 고아',
                            desc: '천애고아로 자랐습니다. 얽힌 인연 없이 자유롭게 운명을 개척합니다.'
                        });
                        continue;
                    }
                    let mother = sameRaceMothers[Math.floor(Math.random() * sameRaceMothers.length)];

                    choices.push({
                        type: 'npc_child',
                        parents: {
                            mother: mother,
                            father: father
                        },
                        title: `${father.lastName.trim()} 가문의 자녀`, // 💡 아버지의 성(가문명) 사용
                        desc: `아버지(${father.lastName.trim()} 가문)와 어머니(${RACES[mother.race].name}) 모두 ${RACES[father.race].name} 혈통입니다.`
                    });
                } else {
                    choices.push({
                        type: 'orphan',
                        title: '부모 미상의 고아',
                        desc: '천애고아로 자랐습니다. 얽힌 인연 없이 자유롭게 운명을 개척합니다.'
                    });
                }
            }
            state.origins = choices;
        }

        function calculateCurrentState() {
            let usedPoints = state.player.addedStats.str + state.player.addedStats.mag + state.player.addedStats.agi + state.player.addedStats.cha;
            const totalBP = state.player.originType === 'isekai' ? REINCARNATION_BONUS_POINTS : DEFAULT_BONUS_POINTS;
            const pointsLeft = totalBP - usedPoints;

            let traitBonus = {
                str: 0,
                mag: 0,
                agi: 0,
                cha: 0,
                gold: 0
            };
            let synergies = [];
            const t = state.player.traits;
            t.forEach(traitId => {
                const trait = TRAITS[traitId];
                if (trait && trait.bonus) {
                    if (trait.bonus.str) traitBonus.str += trait.bonus.str;
                    if (trait.bonus.mag) traitBonus.mag += trait.bonus.mag;
                    if (trait.bonus.agi) traitBonus.agi += trait.bonus.agi;
                    if (trait.bonus.cha) traitBonus.cha += trait.bonus.cha;
                    if (trait.bonus.gold) traitBonus.gold += trait.bonus.gold;
                }
            });

            if (t.includes('berserker') && t.includes('steel_body')) synergies.push({
                name: '불굴의 투사',
                desc: '광전사와 강철의 육체가 결합되어 압도적인 근성과 맷집을 발휘합니다.'
            });
            if (t.includes('nine_yang') && t.includes('troll_blood')) synergies.push({
                name: '불사조의 불꽃',
                desc: '구양절맥의 화상 피해를 트롤의 피로 재생하여 무한 동력을 냅니다.'
            });
            if ((t.includes('succubus_blood') || t.includes('incubus_blood')) && t.includes('mind_reader')) synergies.push({
                name: '치명적인 지배자',
                desc: '상대의 마음을 읽어내 완벽하게 매혹하고 정기를 갈취합니다.'
            });

            const finalStats = {
                str: Math.max(1, Math.min(120, state.player.baseStats.str + state.player.addedStats.str + traitBonus.str)),
                mag: Math.max(1, Math.min(120, state.player.baseStats.mag + state.player.addedStats.mag + traitBonus.mag)),
                agi: Math.max(1, Math.min(120, state.player.baseStats.agi + state.player.addedStats.agi + traitBonus.agi)),
                cha: Math.max(1, Math.min(120, state.player.baseStats.cha + state.player.addedStats.cha + traitBonus.cha))
            };
            const finalGold = Math.max(0, BASE_GOLD + traitBonus.gold);
            return {
                pointsLeft,
                traitBonus,
                finalStats,
                finalGold,
                synergies
            };
        }

        function rollTraits() {
            if (state.player.originType === 'possession') return;
            let keptTraits = [];
            if (state.player.originType === 'isekai') keptTraits.push('reincarnator');
            if (state.player.originType === 'regression') keptTraits.push('regressor');
            if (state.player.originType === 'npc_child' && state.player.parents) {
                const pTraits = [...state.player.parents.mother.traits, ...state.player.parents.father.traits];
                pTraits.forEach(id => {
                    const t = TRAITS[id];
                    if (t && t.tier !== '유일' && Math.random() < 0.3 && !keptTraits.includes(id)) {
                        if (!t.reqAdult || state.adultMode) keptTraits.push(id);
                    }
                });
            }

            // 💡 이스터에그: 잠금된 특성 유지
            if (traitLockMode) {
                lockedTraitsList.forEach(id => {
                    if (!keptTraits.includes(id)) keptTraits.push(id);
                });
            }

            state.player.traits = keptTraits;
            const countRoll = Math.random();
            let numTraits = 1;
            if (countRoll > 0.90) numTraits = 3;
            else if (countRoll > 0.60) numTraits = 2;

            // 💡 잠금된 특성은 랜덤 뽑기 갯수에 포함하지 않고 추가로 부여
            let traitsToRoll = numTraits;

            const availableTraits = Object.values(TRAITS).filter(t => {
                return t.acq === 'innate' && t.tier !== '유일' && (!t.reqGender || t.reqGender === state.player.gender) && (!t.reqAdult || state.adultMode);
            });
            for (let i = 0; i < traitsToRoll; i++) {
                const tierRoll = Math.random();
                let targetTier = '일반';
                if (tierRoll > 0.95) targetTier = '전설';
                else if (tierRoll > 0.80) targetTier = '영웅';
                else if (tierRoll > 0.50) targetTier = '희귀';
                let tierPool = availableTraits.filter(t => t.tier === targetTier && !state.player.traits.includes(t.id));
                if (tierPool.length === 0) tierPool = availableTraits.filter(t => !state.player.traits.includes(t.id));
                if (tierPool.length > 0) {
                    const picked = tierPool[Math.floor(Math.random() * tierPool.length)];
                    state.player.traits.push(picked.id);
                }
            }
        }

        // ==========================================
        // 5. 월드 맵 및 지형 생성 로직
        // ==========================================
        function generateWorldMap(width = MAP_SIZE, height = MAP_SIZE) {
            const seedE = Math.floor(Math.random() * 10000);
            const seedM = Math.floor(Math.random() * 10000);
            const seedT = Math.floor(Math.random() * 10000);
            const seedMana = Math.floor(Math.random() * 10000);
            const seedLight = Math.floor(Math.random() * 10000);

            const seedWarpX = Math.floor(Math.random() * 10000);
            const seedWarpY = Math.floor(Math.random() * 10000);

            let elevation = [];
            let moisture = [];
            let temperature = [];
            let minE = 1,
                maxE = 0;
            let minM = 1,
                maxM = 0;
            let minT = 1,
                maxT = 0;

            for (let y = 0; y < height; y++) {
                elevation[y] = [];
                moisture[y] = [];
                temperature[y] = [];

                let equatorDist = Math.abs(y - height / 2) / (height / 2);
                let baseTemp = 1.0 - equatorDist;

                for (let x = 0; x < width; x++) {
                    let warpX = (fbm(x / 30, y / 30, 4, seedWarpX) - 0.5) * 50;
                    let warpY = (fbm(x / 30, y / 30, 4, seedWarpY) - 0.5) * 50;

                    let wx = x + warpX;
                    let wy = y + warpY;

                    let e = fbm(wx / 45, wy / 45, 5, seedE) * 0.75 + fbm(wx / 15, wy / 15, 3, seedE + 10) * 0.25;
                    let m = fbm(wx / 50, wy / 50, 5, seedM);
                    let t = baseTemp * 0.4 + fbm(wx / 60, wy / 60, 5, seedT) * 0.6;

                    e += (fbm(x / 6, y / 6, 3, seedE + 100) - 0.5) * 0.15;
                    m += (fbm(x / 8, y / 8, 3, seedM + 100) - 0.5) * 0.20;
                    t += (fbm(x / 10, y / 10, 3, seedT + 100) - 0.5) * 0.25;

                    elevation[y][x] = e;
                    moisture[y][x] = m;
                    temperature[y][x] = t;

                    if (e < minE) minE = e;
                    if (e > maxE) maxE = e;
                    if (m < minM) minM = m;
                    if (m > maxM) maxM = m;
                    if (t < minT) minT = t;
                    if (t > maxT) maxT = t;
                }
            }

            let mapData = [];
            let landTiles = [];
            for (let y = 0; y < height; y++) {
                let row = [];
                for (let x = 0; x < width; x++) {
                    let e = (elevation[y][x] - minE) / (maxE - minE);
                    let m = (moisture[y][x] - minM) / (maxM - minM);
                    let t = (temperature[y][x] - minT) / (maxT - minT);

                    let type, color, name;

                    if (e < 0.20) {
                        type = 'deep_water';
                        color = '#1e3a8a';
                        name = '심해';
                    } else if (e < 0.35) {
                        type = 'water';
                        color = '#2563eb';
                        name = '바다';
                    } else if (e < 0.42) {
                        if (t > 0.75) {
                            type = 'coral_reef';
                            color = '#0ea5e9';
                            name = '산호초 해안';
                        } else {
                            type = 'shallows';
                            color = '#38bdf8';
                            name = '얕은 해안';
                        }
                    } else if (e < 0.46) {
                        type = 'sand';
                        color = '#fcd34d';
                        name = '모래 해변';
                    } else if (e > 0.75) {
                        if (t > 0.7 && m < 0.45) {
                            if (e > 0.85) {
                                type = 'canyon';
                                color = '#9a3412';
                                name = '붉은 대협곡';
                            } else {
                                type = 'volcano';
                                color = '#7f1d1d';
                                name = '화산 지대';
                            }
                        } else if (t < 0.35 || (m > 0.5 && e > 0.85)) {
                            type = 'snow';
                            color = '#f4f4f5';
                            name = '만년설산';
                        } else {
                            type = 'mountain';
                            color = '#52525b';
                            name = '험준한 산맥';
                        }
                    } else {
                        if (t > 0.65) {
                            if (m > 0.6) {
                                type = 'jungle';
                                color = '#065f46';
                                name = '열대 우림';
                            } else if (m < 0.3) {
                                // 오아시스 생성 조건을 더 좁게 (수분 0.22 초과, 온도 0.80 미만)
                                if (m > 0.22 && t < 0.80) {
                                    type = 'oasis';
                                    color = '#34d399';
                                    name = '사막 오아시스';
                                } else {
                                    type = 'sand';
                                    color = '#fde047';
                                    name = '건조 사막';
                                }
                            } else {
                                type = 'grass';
                                color = '#65a30d';
                                name = '사바나 평원';
                            }
                        } else if (t > 0.35) {
                            // 늪지대 생성 조건을 더 높게 (수분 0.8 이상), 이름 변경
                            if (m > 0.8) {
                                type = 'swamp';
                                color = '#4d7c0f';
                                name = '늪지대';
                            } else if (m > 0.45) {
                                type = 'forest';
                                color = '#15803d';
                                name = '울창한 숲';
                            } else {
                                type = 'grass';
                                color = '#4ade80';
                                name = '푸른 평원';
                            }
                        } else {
                            if (m > 0.4) {
                                type = 'forest';
                                color = '#0f766e';
                                name = '침엽수림';
                            } else {
                                type = 'tundra';
                                color = '#a1a1aa';
                                name = '얼어붙은 툰드라';
                            }
                        }
                    }

                    let mana = fbm(x / 25, y / 25, 4, seedMana);
                    let light = fbm(x / 40, y / 40, 4, seedLight);

                    let resourceId = null;
                    if (type !== 'deep_water' && type !== 'water' && type !== 'shallows' && type !== 'coral_reef') {
                        let possibleRes = MAP_RESOURCES.filter(r => r.terrains.includes(type));
                        if (possibleRes.length > 0) {
                            for (let res of possibleRes) {
                                if (Math.random() < res.prob) {
                                    resourceId = res.id;
                                    break;
                                }
                            }
                        }
                    }

                    let tile = {
                        x,
                        y,
                        value: e,
                        moisture: m,
                        type,
                        color,
                        name,
                        nationId: null,
                        settlementId: null,
                        influencedBy: null,
                        hasRoad: false,
                        mana: mana,
                        light: light,
                        resourceId: resourceId
                    };
                    row.push(tile);
                    if (type !== 'deep_water' && type !== 'water' && type !== 'shallows' && type !== 'sand' && type !== 'coral_reef') landTiles.push(tile);
                }
                mapData.push(row);
            }

            let waterVisited = new Set();
            const isWaterTile = (tType) => ['water', 'deep_water', 'shallows', 'coral_reef'].includes(tType);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let tile = mapData[y][x];
                    if (isWaterTile(tile.type) && !waterVisited.has(`${x},${y}`)) {
                        let waterBody = [];
                        let queue = [tile];
                        waterVisited.add(`${x},${y}`);

                        while (queue.length > 0) {
                            let curr = queue.shift();
                            waterBody.push(curr);

                            let dirs = [
                                [0, 1],
                                [1, 0],
                                [0, -1],
                                [-1, 0]
                            ];
                            for (let d of dirs) {
                                let nx = curr.x + d[0],
                                    ny = curr.y + d[1];
                                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                    let nTile = mapData[ny][nx];
                                    if (isWaterTile(nTile.type) && !waterVisited.has(`${nx},${ny}`)) {
                                        waterVisited.add(`${nx},${ny}`);
                                        queue.push(nTile);
                                    }
                                }
                            }
                        }

                        if (waterBody.length <= 200) {
                            for (let wTile of waterBody) {
                                wTile.type = 'lake';
                                wTile.name = '맑은 호수';
                                wTile.color = '#0284c7';
                            }
                        }
                    }
                }
            }

            if (landTiles.length > 0) {
                let wtTile = landTiles[Math.floor(Math.random() * landTiles.length)];
                wtTile.type = 'world_tree';
                wtTile.name = '세계수 중심';
                wtTile.color = '#10b981';
                wtTile.mana = 1.0;
                wtTile.light = 1.0;

                let queue = [wtTile];
                let forestTiles = new Set([`${wtTile.x},${wtTile.y}`]);
                let count = 0;
                let targetCount = Math.floor(Math.random() * 20) + 30;
                let attempts = 0;
                while (queue.length > 0 && count < targetCount && attempts < 2000) {
                    let currIdx = Math.floor(Math.random() * queue.length);
                    let curr = queue[currIdx];
                    let dirs = [
                        [0, 1],
                        [1, 0],
                        [0, -1],
                        [-1, 0],
                        [1, 1],
                        [-1, -1],
                        [1, -1],
                        [-1, 1]
                    ];
                    let d = dirs[Math.floor(Math.random() * dirs.length)];
                    let nx = curr.x + d[0];
                    let ny = curr.y + d[1];

                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        let key = `${nx},${ny}`;
                        let t = mapData[ny][nx];
                        if (!forestTiles.has(key) && !isWaterTile(t.type) && t.type !== 'lake') {
                            forestTiles.add(key);
                            t.type = 'forest';
                            t.color = '#064e3b';
                            t.name = '태고의 대수림';
                            t.mana = Math.max(t.mana, 0.9);
                            queue.push(t);
                            count++;
                        }
                    }
                    attempts++;
                }

                let highestPeak = null;
                let mountainTiles = landTiles.filter(t => t.type === 'mountain' || t.type === 'volcano' || t.type === 'canyon');
                if (mountainTiles.length > 0) {
                    highestPeak = mountainTiles.reduce((max, t) => t.value > max.value ? t : max, mountainTiles[0]);
                    highestPeak.type = 'dragon_peak';
                    highestPeak.name = '고대 용의 둥지';
                    highestPeak.color = '#9f1239';
                    highestPeak.mana = 1.0;
                    highestPeak.light = 1.0;
                }

                let coldTiles = landTiles.filter(t => t.type === 'snow' || t.type === 'tundra');
                if (coldTiles.length > 0) {
                    let cave = null;

                    if (highestPeak) {
                        coldTiles.sort((a, b) => {
                            let distA = Math.pow(a.x - highestPeak.x, 2) + Math.pow(a.y - highestPeak.y, 2);
                            let distB = Math.pow(b.x - highestPeak.x, 2) + Math.pow(b.y - highestPeak.y, 2);
                            return distB - distA;
                        });
                        let poolSize = Math.max(1, Math.floor(coldTiles.length * 0.1));
                        cave = coldTiles[Math.floor(Math.random() * poolSize)];
                    } else {
                        cave = coldTiles[Math.floor(Math.random() * coldTiles.length)];
                    }

                    cave.type = 'crystal_cave';
                    cave.name = '빛나는 수정 동굴';
                    cave.color = '#6d28d9';
                    cave.mana = 1.0;
                    cave.light = 1.0;
                }

                let flatTiles = landTiles.filter(t => t.type === 'grass' || t.type === 'oasis');
                if (flatTiles.length > 0) {
                    let monolith = flatTiles[Math.floor(Math.random() * flatTiles.length)];
                    monolith.type = 'ancient_monolith';
                    monolith.name = '고대 성소 유적';
                    monolith.color = '#94a3b8';
                    monolith.mana = 1.0;
                    monolith.light = 1.0;
                }
            }
            return mapData;
        }

        class MinHeap {
            constructor() {
                this.heap = [];
            }
            push(node) {
                this.heap.push(node);
                this.bubbleUp(this.heap.length - 1);
            }
            pop() {
                if (this.heap.length === 1) return this.heap.pop();
                const top = this.heap[0];
                this.heap[0] = this.heap.pop();
                this.sinkDown(0);
                return top;
            }
            bubbleUp(idx) {
                while (idx > 0) {
                    let p = Math.floor((idx - 1) / 2);
                    if (this.heap[p].f <= this.heap[idx].f) break;
                    [this.heap[p], this.heap[idx]] = [this.heap[idx], this.heap[p]];
                    idx = p;
                }
            }
            sinkDown(idx) {
                let len = this.heap.length;
                while (true) {
                    let l = 2 * idx + 1,
                        r = 2 * idx + 2,
                        min = idx;
                    if (l < len && this.heap[l].f < this.heap[min].f) min = l;
                    if (r < len && this.heap[r].f < this.heap[min].f) min = r;
                    if (min === idx) break;
                    [this.heap[idx], this.heap[min]] = [this.heap[min], this.heap[idx]];
                    idx = min;
                }
            }
            isEmpty() {
                return this.heap.length === 0;
            }
        }

        function getTileMovementCost(x, y) {
            let t = state.worldMap[y][x];
            if (t.type === 'deep_water' || t.type === 'water' || t.type === 'lake') return 9999;
            if (t.hasRoad) return 0.5;
            if (t.type === 'volcano' || t.type === 'snow' || t.type === 'dragon_peak' || t.type === 'crystal_cave') return 5;
            if (t.type === 'canyon' || t.type === 'mountain') return 4;
            if (t.type === 'swamp') return 3.5;
            if (t.type === 'world_tree' || t.type === 'coral_reef') return 3;
            if (t.type === 'jungle') return 2.5;
            if (t.type === 'forest' || t.type === 'tundra' || t.type === 'ancient_monolith') return 2;
            if (t.type === 'shallows') return 2;
            if (t.type === 'sand' || t.type === 'oasis') return 1.5;
            return 1;
        }

        function calculatePathAStar(sx, sy, ex, ey, isBuildingRoad = false) {
            let openSet = new MinHeap();
            openSet.push({
                x: sx,
                y: sy,
                g: 0,
                f: 0
            });
            let cameFrom = new Map();
            let gScore = new Map();
            gScore.set(`${sx},${sy}`, 0);
            while (!openSet.isEmpty()) {
                let current = openSet.pop();
                let currentKey = `${current.x},${current.y}`;
                if (current.x === ex && current.y === ey) {
                    let path = [];
                    let currKey = currentKey;
                    while (cameFrom.has(currKey)) {
                        let parts = currKey.split(',');
                        path.unshift({
                            x: parseInt(parts[0]),
                            y: parseInt(parts[1])
                        });
                        currKey = cameFrom.get(currKey);
                    }
                    if (isBuildingRoad) return path;
                    return {
                        cost: current.g,
                        path: path
                    };
                }
                let dirs = [
                    [0, 1],
                    [1, 0],
                    [0, -1],
                    [-1, 0]
                ];
                for (let d of dirs) {
                    let nx = current.x + d[0],
                        ny = current.y + d[1];
                    if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) {
                        // 💡 도로 생성 중일 때 얕은 해안(shallows)은 진입 불가 처리
                        if (isBuildingRoad && state.worldMap[ny][nx].type === 'shallows') continue;

                        let cost = getTileMovementCost(nx, ny);
                        if (cost >= 9999) continue;
                        if (isBuildingRoad && state.worldMap[ny][nx].hasRoad) cost *= 0.8;

                        let nKey = `${nx},${ny}`;
                        let tentativeG = gScore.get(currentKey) + cost;
                        if (!gScore.has(nKey) || tentativeG < gScore.get(nKey)) {
                            cameFrom.set(nKey, currentKey);
                            gScore.set(nKey, tentativeG);
                            let h = Math.abs(nx - ex) + Math.abs(ny - ey);
                            openSet.push({
                                x: nx,
                                y: ny,
                                g: tentativeG,
                                f: tentativeG + h
                            });
                        }
                    }
                }
            }
            return isBuildingRoad ? [] : null;
        }

        function generateRoadNetworks() {
            let majorSettlements = state.settlements.filter(s => s.population >= 50);
            if (majorSettlements.length < 2) return;
            for (let i = 0; i < majorSettlements.length; i++) {
                let s1 = majorSettlements[i];
                let distances = majorSettlements.map((s2, idx) => {
                    if (i === idx) return {
                        idx: -1,
                        d: 999999
                    };
                    return {
                        idx: idx,
                        d: Math.abs(s1.tiles[0].x - s2.tiles[0].x) + Math.abs(s1.tiles[0].y - s2.tiles[0].y)
                    };
                }).filter(d => d.idx !== -1).sort((a, b) => a.d - b.d);
                let targets = distances.slice(0, 1);
                for (let t of targets) {
                    if (t.d > 40) continue;
                    let s2 = majorSettlements[t.idx];
                    let path = calculatePathAStar(s1.tiles[0].x, s1.tiles[0].y, s2.tiles[0].x, s2.tiles[0].y, true);
                    path.forEach(p => {
                        state.worldMap[p.y][p.x].hasRoad = true;
                    });
                }
            }
        }

        // ==========================================
        // 6. 거점 및 도시 빌딩
        // ==========================================
        function createNation(name, desc, color, options = {}) {
            const usedNames = new Set((state.history.nations || []).map(n => n.name));
            let finalName = name || `신흥 왕국 ${state.counters.nation}`;
            if (usedNames.has(finalName)) {
                const base = finalName;
                let idx = 2;
                while (usedNames.has(`${base} ${idx}`)) idx++;
                finalName = `${base} ${idx}`;
            }
            const nation = {
                id: state.counters.nation++,
                name: finalName,
                desc,
                color,
                rulerId: options.rulerId || null,
                founderId: options.founderId || options.rulerId || null,
                capitalSettlementId: options.capitalSettlementId || null,
                ministers: options.ministers || [],
                foundedYear: options.foundedYear || (state.gameDate ? state.gameDate.year : null)
            };
            state.history.nations.push(nation);
            return nation;
        }

        function getNationTemplate() {
            if (!state.history.nationNamePool || state.history.nationNamePool.length === 0) {
                const usedNames = new Set(state.history.nations.map(n => n.name));
                state.history.nationNamePool = (NATION_TEMPLATES || [])
                    .filter(t => !usedNames.has(t.name))
                    .map(t => ({ ...t }));
            }
            return state.history.nationNamePool.length > 0 ? state.history.nationNamePool.shift() : null;
        }

        function generateNationColor() {
            const r = Math.floor(80 + Math.random() * 175);
            const g = Math.floor(80 + Math.random() * 175);
            const b = Math.floor(80 + Math.random() * 175);
            return `rgba(${r}, ${g}, ${b}, 0.45)`;
        }

        function generateNationName(leader, settlement) {
            if (leader && leader.lastName && leader.lastName.trim()) return `${leader.lastName.trim()} 왕국`;
            if (settlement && settlement.name) return `${settlement.name} 왕국`;
            return `신흥 왕국 ${state.counters.nation}`;
        }

        function getSettlementTierRank(type) {
            const order = ['camp', 'village', 'town', 'city', 'metropolis'];
            return order.indexOf(type);
        }

        function getLeaderEntity(leaderId) {
            if (!leaderId) return null;
            if (state.player && state.player.id === leaderId) return state.player;
            return state.npcs.find(n => n.id === leaderId) || null;
        }

        function pickMinisters(rulerId, capital) {
            const ministers = [];
            const candidates = state.npcs.filter(npc => npc.id !== rulerId && npc.location && capital && npc.location.x === capital.tiles[0].x && npc.location.y === capital.tiles[0].y);
            while (candidates.length > 0 && ministers.length < 3) {
                const idx = Math.floor(Math.random() * candidates.length);
                candidates[idx].status = '신하';
                ministers.push(candidates[idx].id);
                candidates.splice(idx, 1);
            }
            while (ministers.length < 2) {
                const newNpc = createRandomNPC();
                newNpc.status = '신하';
                if (capital && capital.tiles && capital.tiles[0]) {
                    newNpc.location = {
                        x: capital.tiles[0].x,
                        y: capital.tiles[0].y
                    };
                }
                ministers.push(newNpc.id);
            }
            return ministers;
        }

        function foundNationFromSettlement(settlement, isHistory = false) {
            if (!settlement || settlement.nationId) return null;
            if (getSettlementTierRank(settlement.type) < getSettlementTierRank('town')) return null;

            if (!settlement.leaderId) {
                const newLeader = createRandomNPC();
                newLeader.location = {
                    x: settlement.tiles[0].x,
                    y: settlement.tiles[0].y
                };
                settlement.leaderId = newLeader.id;
            }

            let leader = getLeaderEntity(settlement.leaderId);
            if (!leader) {
                const newLeader = createRandomNPC();
                newLeader.location = {
                    x: settlement.tiles[0].x,
                    y: settlement.tiles[0].y
                };
                settlement.leaderId = newLeader.id;
                leader = newLeader;
            }

            const tmpl = getNationTemplate();
            const name = tmpl ? tmpl.name : generateNationName(leader, settlement);
            const desc = tmpl ? tmpl.desc : `${settlement.name}을(를) 중심으로 확장한 신흥 왕국입니다.`;
            const color = tmpl ? tmpl.color : generateNationColor();
            const ministers = pickMinisters(leader.id, settlement);
            const nation = createNation(name, desc, color, {
                rulerId: leader.id,
                founderId: leader.id,
                capitalSettlementId: settlement.id,
                ministers,
                foundedYear: state.gameDate ? state.gameDate.year : null
            });

            settlement.nationId = nation.id;
            if (leader === state.player) {
                if (!state.player.titles) state.player.titles = [];
                if (!state.player.titles.includes('국왕')) state.player.titles.unshift('국왕');
                showToast(`[건국] ${name}의 초대 국왕이 되었습니다.`);
            } else if (leader) {
                leader.status = '국왕';
            }
            return nation;
        }

        function assignSettlementNation(settlement, nationId) {
            if (!settlement || !nationId) return;
            settlement.nationId = nationId;
        }

        function applyNationTilesFromInfluence() {
            // Preserve legacy nation assignments on settlements before clearing tiles
            state.settlements.forEach(s => {
                if (s.nationId || !s.tiles || s.tiles.length === 0) return;
                const root = s.tiles[0];
                const rootTile = state.worldMap[root.y][root.x];
                if (rootTile && rootTile.nationId) s.nationId = rootTile.nationId;
            });

            state.worldMap.forEach(row => row.forEach(t => t.nationId = null));

            // 1) Core territory: influenced tiles of settlements with nation
            state.settlements.forEach(s => {
                if (!s.nationId || !s.influencedTiles) return;
                s.influencedTiles.forEach(t => {
                    if (t.x >= 0 && t.x < MAP_SIZE && t.y >= 0 && t.y < MAP_SIZE) {
                        state.worldMap[t.y][t.x].nationId = s.nationId;
                    }
                });
                if (s.tiles) {
                    s.tiles.forEach(t => {
                        if (t.x >= 0 && t.x < MAP_SIZE && t.y >= 0 && t.y < MAP_SIZE) {
                            state.worldMap[t.y][t.x].nationId = s.nationId;
                        }
                    });
                }
            });

            // 2) Border padding up to 3 tiles around influence
            const borderRange = 3;
            state.settlements.forEach(s => {
                if (!s.nationId || !s.influencedTiles) return;
                for (let i = 0; i < s.influencedTiles.length; i++) {
                    const inf = s.influencedTiles[i];
                    for (let dy = -borderRange; dy <= borderRange; dy++) {
                        for (let dx = -borderRange; dx <= borderRange; dx++) {
                            const nx = inf.x + dx;
                            const ny = inf.y + dy;
                            if (nx < 0 || nx >= MAP_SIZE || ny < 0 || ny >= MAP_SIZE) continue;
                            const tile = state.worldMap[ny][nx];
                            if (tile.nationId) continue;
                            if (tile.type === 'deep_water' || tile.type === 'water') continue;
                            if (tile.influencedBy) {
                                const otherSettlement = state.settlements.find(os => os.id === tile.influencedBy);
                                if (otherSettlement && otherSettlement.nationId && otherSettlement.nationId !== s.nationId) continue;
                            }
                            tile.nationId = s.nationId;
                        }
                    }
                }
            });
        }

        function updateNationBordersFromInfluence() {
            applyNationTilesFromInfluence();

            // Annex unaffiliated settlements that lie within borders
            let annexed = false;
            state.settlements.forEach(s => {
                if (s.nationId || !s.tiles || s.tiles.length === 0) return;
                const root = s.tiles[0];
                const tile = state.worldMap[root.y][root.x];
                if (tile && tile.nationId) {
                    assignSettlementNation(s, tile.nationId);
                    annexed = true;
                }
            });

            if (annexed) {
                applyNationTilesFromInfluence();
            }
        }

        function syncCityLayout(s) {
            let minX = Math.min(...s.tiles.map(t => t.x));
            let maxX = Math.max(...s.tiles.map(t => t.x));
            let minY = Math.min(...s.tiles.map(t => t.y));
            let maxY = Math.max(...s.tiles.map(t => t.y));
            let gw = (maxX - minX + 1) * 50;
            let gh = (maxY - minY + 1) * 50;
            let isNew = !s.layoutData;

            if (isNew) {
                s.layoutData = {
                    grid: Array(gh).fill(0).map(() => Array(gw).fill('wild')),
                    instances: [],
                    gw,
                    gh,
                    minX,
                    minY
                };
            } else {
                if (s.layoutData.minX !== minX || s.layoutData.minY !== minY || s.layoutData.gw !== gw || s.layoutData.gh !== gh) {
                    let newGrid = Array(gh).fill(0).map(() => Array(gw).fill('wild'));
                    let offsetX = s.layoutData.minX - minX;
                    let offsetY = s.layoutData.minY - minY;
                    for (let r = 0; r < s.layoutData.gh; r++) {
                        for (let c = 0; c < s.layoutData.gw; c++) {
                            if (newGrid[r + offsetY * 50] && newGrid[r + offsetY * 50][c + offsetX * 50]) {
                                newGrid[r + offsetY * 50][c + offsetX * 50] = s.layoutData.grid[r][c];
                            }
                        }
                    }
                    s.layoutData.instances.forEach(inst => {
                        inst.x += offsetX * 50;
                        inst.y += offsetY * 50;
                    });
                    s.layoutData.grid = newGrid;
                    s.layoutData.gw = gw;
                    s.layoutData.gh = gh;
                    s.layoutData.minX = minX;
                    s.layoutData.minY = minY;
                }
            }

            let seed1 = parseInt(s.id.split('_')[1]) * 10;
            let seed2 = seed1 + 5;
            let baseTileType = 'grass';
            if (s.tiles.length > 0 && state.worldMap[s.tiles[0].y] && state.worldMap[s.tiles[0].y][s.tiles[0].x]) {
                baseTileType = state.worldMap[s.tiles[0].y][s.tiles[0].x].type;
            }
            let terrainPalette = {
                grass: {
                    base: 'grass',
                    alt1: 'dirt',
                    alt2: 'rock'
                },
                forest: {
                    base: 'dark_grass',
                    alt1: 'grass',
                    alt2: 'dirt'
                },
                sand: {
                    base: 'sand',
                    alt1: 'dirt',
                    alt2: 'rock'
                },
                snow: {
                    base: 'snow',
                    alt1: 'ice',
                    alt2: 'rock'
                },
                mountain: {
                    base: 'rock',
                    alt1: 'dirt',
                    alt2: 'snow'
                },
                world_tree: {
                    base: 'magic_grass',
                    alt1: 'dark_grass',
                    alt2: 'water'
                },
                swamp: {
                    base: 'dark_grass',
                    alt1: 'water',
                    alt2: 'dirt'
                },
                jungle: {
                    base: 'dark_grass',
                    alt1: 'grass',
                    alt2: 'water'
                },
                tundra: {
                    base: 'snow',
                    alt1: 'dirt',
                    alt2: 'rock'
                },
                volcano: {
                    base: 'rock',
                    alt1: 'dirt',
                    alt2: 'rock'
                },
                shallows: {
                    base: 'sand',
                    alt1: 'water',
                    alt2: 'sand'
                },
                deep_water: {
                    base: 'water',
                    alt1: 'water',
                    alt2: 'water'
                },
                water: {
                    base: 'water',
                    alt1: 'water',
                    alt2: 'water'
                },
                lake: {
                    base: 'water',
                    alt1: 'water',
                    alt2: 'water'
                },
                coral_reef: {
                    base: 'sand',
                    alt1: 'water',
                    alt2: 'water'
                },
                canyon: {
                    base: 'rock',
                    alt1: 'dirt',
                    alt2: 'sand'
                },
                oasis: {
                    base: 'grass',
                    alt1: 'water',
                    alt2: 'sand'
                },
                dragon_peak: {
                    base: 'rock',
                    alt1: 'dirt',
                    alt2: 'rock'
                },
                crystal_cave: {
                    base: 'rock',
                    alt1: 'ice',
                    alt2: 'snow'
                },
                ancient_monolith: {
                    base: 'grass',
                    alt1: 'rock',
                    alt2: 'dirt'
                }
            };
            let palette = terrainPalette[baseTileType] || terrainPalette.grass;

            for (let r = 0; r < gh; r++) {
                for (let c = 0; c < gw; c++) {
                    if (s.layoutData.grid[r][c] === 'wild') {
                        let wX = minX + Math.floor(c / 50);
                        let wY = minY + Math.floor(r / 50);
                        if (s.tiles.some(t => t.x === wX && t.y === wY)) {
                            let rx = wX * 50 + c;
                            let ry = wY * 50 + r;
                            let n1 = fbm(rx * 0.04, ry * 0.04, 3, seed1);
                            let river = Math.abs(fbm(rx * 0.02, ry * 0.02, 2, seed2) - 0.5);
                            if (river < 0.06 && baseTileType !== 'sand' && baseTileType !== 'snow') s.layoutData.grid[r][c] = 'water';
                            else if (river < 0.06 && baseTileType === 'snow') s.layoutData.grid[r][c] = 'ice';
                            else if (n1 > 0.65) s.layoutData.grid[r][c] = palette.alt2;
                            else if (n1 < 0.35) s.layoutData.grid[r][c] = palette.alt1;
                            else s.layoutData.grid[r][c] = palette.base;
                        }
                    }
                }
            }

            function drawCityRoad(x1, y1, x2, y2) {
                let cx = x1,
                    cy = y1;
                let steps = 0;
                while ((Math.abs(cx - x2) > 0 || Math.abs(cy - y2) > 0) && steps < 1000) {
                    if (s.layoutData.grid[cy] && s.layoutData.grid[cy][cx] && s.layoutData.grid[cy][cx] !== 'wild' && s.layoutData.grid[cy][cx] !== 'water') {
                        s.layoutData.grid[cy][cx] = 'road';
                        if (Math.random() < 0.5 && s.layoutData.grid[cy] && s.layoutData.grid[cy][cx + 1] && s.layoutData.grid[cy][cx + 1] !== 'wild' && s.layoutData.grid[cy][cx + 1] !== 'water') s.layoutData.grid[cy][cx + 1] = 'road';
                        if (Math.random() < 0.5 && s.layoutData.grid[cy + 1] && s.layoutData.grid[cy + 1][cx] !== 'wild' && s.layoutData.grid[cy + 1][cx] !== 'water') s.layoutData.grid[cy + 1][cx] = 'road';
                    }
                    if (Math.random() < 0.15) {
                        let dirs = [
                            [0, 1],
                            [1, 0],
                            [0, -1],
                            [-1, 0]
                        ];
                        let d = dirs[Math.floor(Math.random() * 4)];
                        if (s.layoutData.grid[cy + d[1]] && s.layoutData.grid[cy + d[1]][cx + d[0]] && s.layoutData.grid[cy + d[1]][cx + d[0]] !== 'wild' && s.layoutData.grid[cy + d[1]][cx + d[0]] !== 'water') {
                            cx += d[0];
                            cy += d[1];
                        }
                    } else {
                        if (Math.abs(cx - x2) > Math.abs(cy - y2)) cx += cx < x2 ? 1 : -1;
                        else cy += cy < y2 ? 1 : -1;
                    }
                    steps++;
                }
            }

            if (isNew) {
                let centers = s.tiles.map(t => ({
                    x: (t.x - minX) * 50 + 25,
                    y: (t.y - minY) * 50 + 25
                }));
                for (let i = 0; i < centers.length - 1; i++) drawCityRoad(centers[i].x, centers[i].y, centers[i + 1].x, centers[i + 1].y);
                for (let i = 0; i < s.tiles.length * 4; i++) {
                    let c = centers[Math.floor(Math.random() * centers.length)];
                    let angle = Math.random() * Math.PI * 2;
                    let len = Math.random() * 20 + 10;
                    let ex = Math.floor(c.x + Math.cos(angle) * len);
                    let ey = Math.floor(c.y + Math.sin(angle) * len);
                    drawCityRoad(c.x, c.y, ex, ey);
                }
            }

            function place(type, binfo, prefTerrain) {
                let placed = false;
                let attempts = 0;
                let minW = binfo.w || 2,
                    maxW = binfo.w || 2;
                let minH = binfo.h || 2,
                    maxH = binfo.h || 2;
                while (!placed && attempts < 200) {
                    let w = Math.floor(Math.random() * (maxW - minW + 1)) + minW;
                    let h = Math.floor(Math.random() * (maxH - minH + 1)) + minH;
                    let x = Math.floor(Math.random() * (gw - w));
                    let y = Math.floor(Math.random() * (gh - h));
                    let valid = true;
                    let hasPref = false;
                    let hasRoadAdj = false;
                    for (let r = y - 1; r <= y + h; r++) {
                        for (let c = x - 1; c <= x + w; c++) {
                            if (r < 0 || c < 0 || r >= gh || c >= gw) {
                                valid = false;
                                break;
                            }
                            let t = s.layoutData.grid[r][c];
                            if (t === 'wild' || t === 'building' || t === 'water') {
                                valid = false;
                                break;
                            }
                            if (r >= y && r < y + h && c >= x && c < x + w) {
                                if (t === 'road') valid = false;
                                if (prefTerrain && t === prefTerrain) hasPref = true;
                            } else {
                                if (t === 'road') hasRoadAdj = true;
                            }
                        }
                        if (!valid) break;
                    }
                    let needRoad = type !== 'farm';
                    if (valid && (!needRoad || hasRoadAdj) && (!prefTerrain || hasPref || Math.random() < 0.2)) {
                        for (let r = y; r < y + h; r++)
                            for (let c = x; c < x + w; c++) s.layoutData.grid[r][c] = 'building';
                        s.layoutData.instances.push({
                            id: 'fac_' + state.counters.building++,
                            type,
                            x,
                            y,
                            w,
                            h,
                            sizeBonus: w * h
                        });
                        placed = true;
                    }
                    attempts++;
                }
                return placed;
            }

            s.buildings.forEach(bId => {
                if (!s.layoutData.instances.some(i => i.type === bId)) {
                    let binfo = BUILDINGS[bId];
                    if (binfo) place(bId, binfo, null);
                }
            });
            let targetFarms = Math.floor(s.population / 30);
            let targetHouses = Math.floor(s.population / 15);
            let currentFarms = s.layoutData.instances.filter(i => i.type === 'farm').length;
            let currentHouses = s.layoutData.instances.filter(i => i.type === 'house' || i.type === 'hut').length;
            for (let i = 0; i < targetFarms - currentFarms; i++) place('farm', BUILDINGS['farm'], palette.alt1);
            for (let i = 0; i < targetHouses - currentHouses; i++) place('house', BUILDINGS['house'], null);
        }

        function checkSettlementBuildings(s) {
            if (!s.buildings) s.buildings = [];
            let add = (id, prob) => {
                if (!s.buildings.includes(id) && Math.random() < prob) s.buildings.push(id);
            }
            if (s.population >= 1) {
                add('hut', 1.0);
                add('well', 0.8);
                add('campfire', 0.9);
            }
            if (s.population >= 10) {
                add('noticeboard', 0.8);
                add('herb_rack', 0.6);
            }
            if (s.population >= 20) {
                add('storage', 0.7);
            }
            if (s.population >= 50) {
                add('chief_house', 1.0);
                add('tavern', 0.8);
                add('general_store', 0.7);
            }
            if (s.population >= 80) {
                add('training_ground', 0.6);
                add('chapel', 0.5);
            }
            if (s.population >= 150) {
                add('blacksmith', 0.6);
                add('inn', 0.5);
            }
            if (s.population >= 500) {
                add('guardhouse', 0.8);
                add('market', 0.8);
            }
            if (s.population >= 800) {
                add('library', 0.5);
                add('stable', 0.6);
                add('dojo', 0.4);
            }
            if (s.population >= 3000) {
                add('manor', 1.0);
                add('plaza', 1.0);
                add('guild_office', 0.8);
                add('bank', 0.7);
            }
            if (s.population >= 6000) {
                add('mage_tower', 0.5);
                add('alchemy_lab', 0.6);
            }
            if (s.population >= 15000) {
                add('castle', 0.8);
                add('club', 0.9);
                add('grand_cathedral', 0.7);
            }
            if (s.population >= 25000) {
                add('arena', 0.6);
                add('port', 0.5);
            }
            syncCityLayout(s);
        }

        function expandSettlementArea(settlement, targetSize) {
            if (settlement.tiles.length >= targetSize) return;
            let queue = [...settlement.tiles];
            let visited = new Set(settlement.tiles.map(t => `${t.x},${t.y}`));
            while (queue.length > 0 && settlement.tiles.length < targetSize) {
                let current = queue.shift();
                let dirs = [
                    [0, 1],
                    [1, 0],
                    [0, -1],
                    [-1, 0]
                ];
                dirs.sort(() => Math.random() - 0.5);
                for (let d of dirs) {
                    let nx = current.x + d[0];
                    let ny = current.y + d[1];
                    if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) {
                        let key = `${nx},${ny}`;
                        if (!visited.has(key)) {
                            visited.add(key);
                            let nTile = state.worldMap[ny][nx];
                            if (!nTile.settlementId && nTile.type !== 'deep_water' && nTile.type !== 'water') {
                                nTile.settlementId = settlement.id;
                                settlement.tiles.push({
                                    x: nx,
                                    y: ny
                                });
                                queue.push({
                                    x: nx,
                                    y: ny
                                });
                                if (settlement.tiles.length >= targetSize) break;
                            }
                        }
                    }
                }
            }
        }

        function checkSettlementUpgrades(s) {
            let oldType = s.type;
            let oldLen = s.tiles.length;
            if (s.type === 'camp' && s.population >= SETTLEMENT_TIERS.village.minPop) {
                s.type = 'village';
            } else if (s.type === 'village' && s.population >= SETTLEMENT_TIERS.town.minPop) {
                s.type = 'town';
                expandSettlementArea(s, SETTLEMENT_TIERS.town.maxTiles);
            } else if (s.type === 'town' && s.population >= SETTLEMENT_TIERS.city.minPop) {
                s.type = 'city';
                expandSettlementArea(s, SETTLEMENT_TIERS.city.maxTiles);
            } else if (s.type === 'city' && s.population >= SETTLEMENT_TIERS.metropolis.minPop) {
                s.type = 'metropolis';
                expandSettlementArea(s, SETTLEMENT_TIERS.metropolis.maxTiles);
            }

            if ((s.type === 'town' || s.type === 'city' || s.type === 'metropolis') && !s.leaderId) {
                const newLeader = createRandomNPC();
                newLeader.location = {
                    x: s.tiles[0].x,
                    y: s.tiles[0].y
                };
                s.leaderId = newLeader.id;
            }
            checkSettlementBuildings(s);
            if (oldLen !== s.tiles.length) syncCityLayout(s);
            return oldType !== s.type;
        }

        function createSettlement(name, x, y, founderId = null, initialPop = 1) {
            const tile = state.worldMap[y][x];
            if (tile.settlementId || tile.influencedBy || tile.type === 'deep_water' || tile.type === 'water') return null;
            let type = 'camp';
            if (initialPop >= SETTLEMENT_TIERS.metropolis.minPop) type = 'metropolis';
            else if (initialPop >= SETTLEMENT_TIERS.city.minPop) type = 'city';
            else if (initialPop >= SETTLEMENT_TIERS.town.minPop) type = 'town';
            else if (initialPop >= SETTLEMENT_TIERS.village.minPop) type = 'village';

            let isHighTier = (type === 'metropolis' || type === 'city' || type === 'town');
            if (!founderId) {
                if (isHighTier || Math.random() < 0.5) {
                    const newLeader = createRandomNPC();
                    newLeader.location = {
                        x,
                        y
                    };
                    founderId = newLeader.id;
                } else {
                    founderId = null;
                }
            }

            const s = {
                id: 's_' + state.counters.settlement++,
                name: name,
                type: type,
                population: initialPop,
                tiles: [{
                    x,
                    y
                }],
                influencedTiles: [{
                    x,
                    y
                }],
                culturePoints: 0,
                leaderId: founderId,
                nationId: null,
                buildings: [],
                layoutData: null
            };
            checkSettlementBuildings(s);
            tile.settlementId = s.id;
            tile.influencedBy = s.id;
            state.settlements.push(s);
            if (SETTLEMENT_TIERS[type].maxTiles > 1) {
                expandSettlementArea(s, SETTLEMENT_TIERS[type].maxTiles);
                syncCityLayout(s);
            }
            return s;
        }

        function processHistorySettlements(weeks = 100, settlementModifiers = null) {
            state.settlements.forEach(s => {
                updateSettlementFoodAndPopulation(s, weeks, true, settlementModifiers);
                checkSettlementUpgrades(s);
                processCultureExpansion(s, weeks, true);
                foundNationFromSettlement(s, true);
            });
            if (Math.random() < 0.7) {
                let validTiles = [];
                state.worldMap.forEach(row => row.forEach(t => {
                    if ((t.type === 'grass' || t.type === 'forest') && !t.settlementId && !t.influencedBy) validTiles.push(t);
                }));
                if (validTiles.length > 0) {
                    let t = validTiles[Math.floor(Math.random() * validTiles.length)];
                    createSettlement(generateSettlementName(), t.x, t.y, null, Math.floor(Math.random() * 150) + 50);
                }
            }
        }

        // ==========================================
        // 7. 역사 시뮬레이션
        // ==========================================
        function initHistorySimulation() {
            const historyTurnIntervalMs = 700;
            state.tileSize = 4; // 줌아웃 상태로 시작
            state.worldMap = generateWorldMap(MAP_SIZE, MAP_SIZE);
            if (typeof minimapCache !== 'undefined') minimapCache.dirty = true;
            state.history.logs = [];
            state.history.currentTurn = 0;
            state.gameDate = {
                year: 52,
                month: 3,
                week: 1
            };
            state.settlements = [];
            state.hostileBands = [];
            state.history.nations = [];
            state.npcs = [];
            state.counters.nation = 1;
            state.counters.npc = 1;
            state.counters.settlement = 1;
            state.counters.building = 1;
            state.counters.hostileBand = 1;
            state.history.nationNamePool = (NATION_TEMPLATES || []).map(t => ({ ...t }));
            state.history.isRunning = true;
            state.history.isFinished = false;
            state.history.isPaused = false;
            state.history.isPausedForEvent = false;
            state.history.pendingWorldEventChoices = [];
            state.history.otherworld = {
                active: false,
                nextCoreId: 1,
                cores: [],
                tiles: {},
                splitRadius: 6,
                battleRange: 2
            };
            state.history.threats = {
                nextBandId: 1,
                demonLord: {
                    active: false,
                    castle: null,
                    spawnIntervalTurns: 20,
                    nextSpawnTurn: 0,
                    bands: []
                },
                dragon: {
                    active: false,
                    nest: null,
                    cooldownTurns: 12,
                    nextRaidTurn: 0
                }
            };
            state.history.majorFigures = [];
            state.history.turnIntervalMs = historyTurnIntervalMs;
        }

        function getOtherworldState() {
            if (!state.history.otherworld) {
                state.history.otherworld = {
                    active: false,
                    nextCoreId: 1,
                    cores: [],
                    tiles: {},
                    splitRadius: 6,
                    battleRange: 2
                };
            }
            return state.history.otherworld;
        }

        function getHistoryThreatState() {
            if (!state.history.threats) {
                state.history.threats = {
                    nextBandId: 1,
                    demonLord: {
                        active: false,
                        castle: null,
                        spawnIntervalTurns: 20,
                        nextSpawnTurn: 0,
                        bands: []
                    },
                    dragon: {
                        active: false,
                        nest: null,
                        cooldownTurns: 12,
                        nextRaidTurn: 0
                    }
                };
            }
            return state.history.threats;
        }

        function getHistoryMajorFigures() {
            if (!state.history.majorFigures) state.history.majorFigures = [];
            return state.history.majorFigures;
        }

        function getOtherworldKey(x, y) {
            return `${x},${y}`;
        }

        function getRandomOtherworldCoreTile() {
            const candidates = [];
            for (let y = 0; y < MAP_SIZE; y++) {
                for (let x = 0; x < MAP_SIZE; x++) {
                    const tile = state.worldMap[y][x];
                    if (!tile) continue;
                    if (tile.type === 'deep_water' || tile.type === 'water' || tile.type === 'lake') continue;
                    if (tile.settlementId) continue;
                    candidates.push({
                        x,
                        y
                    });
                }
            }
            if (candidates.length <= 0) return null;
            return candidates[Math.floor(Math.random() * candidates.length)];
        }

        function markOtherworldCorruption(core, x, y) {
            if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) return;
            const tile = state.worldMap[y][x];
            if (!tile || tile.type === 'deep_water' || tile.type === 'water' || tile.type === 'lake') return;

            const o = getOtherworldState();
            const key = getOtherworldKey(x, y);
            if (!o.tiles[key]) {
                o.tiles[key] = {
                    x,
                    y,
                    originalType: tile.type,
                    coreIds: [core.id]
                };
            } else if (!o.tiles[key].coreIds.includes(core.id)) {
                o.tiles[key].coreIds.push(core.id);
            }

            if (!core.corruptedKeys.includes(key)) core.corruptedKeys.push(key);
            tile.type = 'crystal_cave';
        }

        function spawnOtherworldCore(x, y, generation = 0, parentId = null) {
            const o = getOtherworldState();
            const core = {
                id: o.nextCoreId++,
                x,
                y,
                generation,
                parentId,
                radius: 0,
                spawnedChild: false,
                alive: true,
                corruptedKeys: []
            };
            o.cores.push(core);
            markOtherworldCorruption(core, x, y);
            return core;
        }

        function activateOtherworldErosion(currentYear) {
            const o = getOtherworldState();
            if (o.active && o.cores.some(c => c.alive)) return;
            const pos = getRandomOtherworldCoreTile();
            if (!pos) {
                state.history.logs.unshift(`[${currentYear}년] 🌀 [월드 이벤트] 이계 침식이 시도되었지만 안정적인 핵이 자리잡지 못했습니다.`);
                return;
            }
            o.active = true;
            const core = spawnOtherworldCore(pos.x, pos.y, 0, null);
            state.history.logs.unshift(`[${currentYear}년] 🌀 [월드 이벤트] 이계 중심핵이 (${core.x}, ${core.y})에 생성되었습니다.`);
        }

        function expandOtherworldCore(core) {
            if (!core.alive) return;
            const nextRadius = core.radius + 1;
            const ringTiles = [];
            for (let dy = -nextRadius; dy <= nextRadius; dy++) {
                for (let dx = -nextRadius; dx <= nextRadius; dx++) {
                    const manhattan = Math.abs(dx) + Math.abs(dy);
                    if (manhattan !== nextRadius) continue;
                    const tx = core.x + dx;
                    const ty = core.y + dy;
                    if (tx < 0 || tx >= MAP_SIZE || ty < 0 || ty >= MAP_SIZE) continue;
                    markOtherworldCorruption(core, tx, ty);
                    ringTiles.push({
                        x: tx,
                        y: ty
                    });
                }
            }
            core.radius = nextRadius;
            if (!core.spawnedChild && core.radius >= getOtherworldState().splitRadius && ringTiles.length > 0) {
                const pos = ringTiles[Math.floor(Math.random() * ringTiles.length)];
                spawnOtherworldCore(pos.x, pos.y, core.generation + 1, core.id);
                core.spawnedChild = true;
            }
        }

        function computeSettlementDefensePower(settlement) {
            const tier = Math.max(0, getSettlementTierRank(settlement.type));
            const popPower = Math.sqrt(Math.max(1, settlement.population || 1)) * 4.5;
            const militaryBuildings = (settlement.buildings || []).filter(b => b === 'training_ground' || b === 'guardhouse' || b === 'castle' || b === 'dojo').length;
            const nationBonus = settlement.nationId ? 35 : 0;
            return popPower + (tier * 45) + (militaryBuildings * 28) + nationBonus + Math.random() * 30;
        }

        function destroyOtherworldCore(core, currentYear, reason = 'settlement_defense') {
            if (!core || !core.alive) return;
            const o = getOtherworldState();
            core.alive = false;

            Object.keys(o.tiles).forEach(key => {
                const tState = o.tiles[key];
                const idx = tState.coreIds.indexOf(core.id);
                if (idx >= 0) tState.coreIds.splice(idx, 1);
                if (tState.coreIds.length <= 0) {
                    const tile = state.worldMap[tState.y] && state.worldMap[tState.y][tState.x];
                    if (tile) tile.type = tState.originalType;
                    delete o.tiles[key];
                }
            });

            if (reason === 'settlement_defense') {
                state.history.logs.unshift(`[${currentYear}년] 🛡️ [이계 전선] 정착지 연합군이 이계 중심핵 하나를 파괴했습니다.`);
            } else {
                state.history.logs.unshift(`[${currentYear}년] ⚠️ [이계 전선] 이계 중심핵 하나가 붕괴하며 침식 지대가 수축했습니다.`);
            }
        }

        function resolveOtherworldSettlementConflicts(currentYear) {
            const o = getOtherworldState();
            if (!o.active) return;
            o.cores.forEach(core => {
                if (!core.alive) return;
                const nearby = state.settlements.filter(s => {
                    if (!s || !s.tiles || s.tiles.length <= 0) return false;
                    const origin = s.tiles[0];
                    return Math.abs(origin.x - core.x) + Math.abs(origin.y - core.y) <= (core.radius + o.battleRange);
                });
                nearby.forEach(settlement => {
                    const settlementPower = computeSettlementDefensePower(settlement);
                    const corePower = 90 + (core.generation * 35) + (core.radius * 18) + Math.random() * 55;
                    if (settlementPower >= corePower) {
                        destroyOtherworldCore(core, currentYear, 'settlement_defense');
                        return;
                    }
                    const lossRate = 0.35 + Math.random() * 0.3;
                    settlement.population = Math.max(0, Math.floor((settlement.population || 0) * (1 - lossRate)));
                    if (settlement.population <= 0 || Math.random() < 0.22) {
                        const root = settlement.tiles[0];
                        if (state.worldMap[root.y] && state.worldMap[root.y][root.x]) {
                            state.worldMap[root.y][root.x].settlementId = null;
                        }
                        settlement.nationId = null;
                        settlement.type = 'camp';
                        settlement.buildings = [];
                        state.history.logs.unshift(`[${currentYear}년] ☠️ [이계 전선] ${settlement.name} 정착지가 이계 침식에 함락되었습니다.`);
                    } else {
                        checkSettlementUpgrades(settlement);
                        state.history.logs.unshift(`[${currentYear}년] ⚔️ [이계 전선] ${settlement.name} 정착지가 이계 군세와 격돌해 큰 피해를 입었습니다.`);
                    }
                });
            });
        }

        function processOtherworldErosionTurn(currentYear) {
            const o = getOtherworldState();
            if (!o.active) return;
            o.cores.forEach(core => {
                if (core.alive) expandOtherworldCore(core);
            });
            resolveOtherworldSettlementConflicts(currentYear);

            const aliveCores = o.cores.filter(c => c.alive);
            if (aliveCores.length <= 0) {
                o.active = false;
                state.history.logs.unshift(`[${currentYear}년] 🌤️ [이계 전선] 모든 이계 중심핵이 파괴되어 침식이 멈췄습니다.`);
            }
        }

        function findNearestSettlementPosition(x, y) {
            let best = null;
            let bestDist = Infinity;
            state.settlements.forEach(s => {
                if (!s || !s.tiles || s.tiles.length <= 0 || (s.population || 0) <= 0) return;
                const root = s.tiles[0];
                const d = Math.abs(root.x - x) + Math.abs(root.y - y);
                if (d < bestDist) {
                    bestDist = d;
                    best = {
                        settlement: s,
                        dist: d
                    };
                }
            });
            return best;
        }

        function pickThreatSpawnTile() {
            const candidates = [];
            for (let y = 0; y < MAP_SIZE; y++) {
                for (let x = 0; x < MAP_SIZE; x++) {
                    const tile = state.worldMap[y][x];
                    if (!tile || tile.settlementId) continue;
                    if (tile.type === 'deep_water' || tile.type === 'water' || tile.type === 'lake') continue;
                    candidates.push({
                        x,
                        y
                    });
                }
            }
            if (candidates.length <= 0) return null;
            return candidates[Math.floor(Math.random() * candidates.length)];
        }

        function inflictSettlementRaidDamage(settlement, lossFactor = 1) {
            const rate = Math.min(0.85, Math.max(0.12, lossFactor));
            settlement.population = Math.max(0, Math.floor((settlement.population || 0) * (1 - rate)));
            if (Math.random() < 0.35 && settlement.buildings && settlement.buildings.length > 0) {
                settlement.buildings.splice(Math.floor(Math.random() * settlement.buildings.length), 1);
            }
            if (settlement.population <= 0) {
                settlement.type = 'camp';
                settlement.nationId = null;
                settlement.buildings = [];
            } else {
                checkSettlementUpgrades(settlement);
            }
        }

        function activateDemonLordThreat(currentYear) {
            const threats = getHistoryThreatState();
            if (threats.demonLord.active) return;
            const pos = pickThreatSpawnTile();
            if (!pos) {
                state.history.logs.unshift(`[${currentYear}년] 👑 [월드 이벤트] 마왕 강림이 시도되었으나 마왕성이 자리잡을 땅을 찾지 못했습니다.`);
                return;
            }
            threats.demonLord.active = true;
            threats.demonLord.castle = {
                x: pos.x,
                y: pos.y
            };
            threats.demonLord.nextSpawnTurn = state.history.currentTurn + threats.demonLord.spawnIntervalTurns;
            const tile = state.worldMap[pos.y][pos.x];
            if (tile) tile.type = 'volcano';
            state.history.logs.unshift(`[${currentYear}년] 👑 [월드 이벤트] 마왕성이 (${pos.x}, ${pos.y})에 강림했습니다.`);
        }

        function processDemonLordThreatTurn(currentYear) {
            const threats = getHistoryThreatState();
            const lord = threats.demonLord;
            if (!lord.active || !lord.castle) return;

            if (state.history.currentTurn >= lord.nextSpawnTurn) {
                const band = {
                    id: `dl_band_${threats.nextBandId++}`,
                    x: lord.castle.x,
                    y: lord.castle.y,
                    power: 120 + Math.random() * 90 + (state.history.currentTurn * 0.08)
                };
                lord.bands.push(band);
                lord.nextSpawnTurn += lord.spawnIntervalTurns;
                state.history.logs.unshift(`[${currentYear}년] 🩸 [마왕군] 마왕성에서 적대적 무리 #${band.id}가 출진했습니다.`);
            }

            const survivors = [];
            lord.bands.forEach(band => {
                const nearest = findNearestSettlementPosition(band.x, band.y);
                if (!nearest || !nearest.settlement) return;
                const target = nearest.settlement;
                const root = target.tiles[0];
                if (!root) return;
                const dx = Math.sign(root.x - band.x);
                const dy = Math.sign(root.y - band.y);
                band.x += dx;
                band.y += dy;

                const arrived = (band.x === root.x && band.y === root.y);
                if (!arrived) {
                    survivors.push(band);
                    return;
                }

                const defense = computeSettlementDefensePower(target);
                const attack = band.power + (Math.random() * 45);
                if (defense >= attack) {
                    state.history.logs.unshift(`[${currentYear}년] 🛡️ [마왕군] ${target.name}이(가) 침공한 적대적 무리 #${band.id}를 격파했습니다.`);
                    return;
                }

                inflictSettlementRaidDamage(target, 0.28 + Math.random() * 0.22);
                state.history.logs.unshift(`[${currentYear}년] 🔥 [마왕군] ${target.name}이(가) 침공당해 큰 피해를 입었습니다.`);
            });
            lord.bands = survivors;
        }

        function activateDragonThreat(currentYear) {
            const threats = getHistoryThreatState();
            if (threats.dragon.active) return;
            const pos = pickThreatSpawnTile();
            if (!pos) {
                state.history.logs.unshift(`[${currentYear}년] 🐉 [월드 이벤트] 드래곤이 둥지를 틀 장소를 찾지 못했습니다.`);
                return;
            }
            threats.dragon.active = true;
            threats.dragon.nest = {
                x: pos.x,
                y: pos.y
            };
            threats.dragon.nextRaidTurn = state.history.currentTurn + 2;
            const tile = state.worldMap[pos.y][pos.x];
            if (tile) tile.type = 'dragon_peak';
            state.history.logs.unshift(`[${currentYear}년] 🐉 [월드 이벤트] 드래곤 둥지가 (${pos.x}, ${pos.y})에 형성되었습니다.`);
        }

        function processDragonThreatTurn(currentYear) {
            const threats = getHistoryThreatState();
            const dragon = threats.dragon;
            if (!dragon.active || !dragon.nest) return;
            if (state.history.currentTurn < dragon.nextRaidTurn) return;

            const nearest = findNearestSettlementPosition(dragon.nest.x, dragon.nest.y);
            if (!nearest || !nearest.settlement) {
                dragon.nextRaidTurn = state.history.currentTurn + dragon.cooldownTurns;
                return;
            }
            const target = nearest.settlement;
            const defense = computeSettlementDefensePower(target);
            const dragonPower = 240 + (Math.random() * 100) + (state.history.currentTurn * 0.1);

            if (defense >= dragonPower) {
                state.history.logs.unshift(`[${currentYear}년] ⚔️ [드래곤의 분노] ${target.name}이(가) 드래곤의 급습을 막아냈습니다. 드래곤은 둥지로 퇴각했습니다.`);
            } else {
                inflictSettlementRaidDamage(target, 0.42 + Math.random() * 0.24);
                state.history.logs.unshift(`[${currentYear}년] 🐲 [드래곤의 분노] 드래곤이 ${target.name}을(를) 습격한 뒤 둥지로 돌아갔습니다.`);
            }

            dragon.nextRaidTurn = state.history.currentTurn + dragon.cooldownTurns;
        }

        function processHistoryThreatsTurn(currentYear) {
            processDemonLordThreatTurn(currentYear);
            processDragonThreatTurn(currentYear);
        }

        function hasMajorFigureRole(role) {
            return getHistoryMajorFigures().some(f => f.role === role);
        }

        function createHistoryMajorFigure(role, currentYear, sortedNations = [], options = {}) {
            if (!state.settlements || state.settlements.length <= 0) return null;
            const npc = options.existingNpc || createRandomNPC();
            let title = '방랑자';
            let targetSettlement = options.targetSettlement || null;
            let homeNationId = options.homeNationId || null;
            let speed = 2;

            if (role === 'hero') {
                title = '용사';
                speed = 3;
                if (!targetSettlement) targetSettlement = [...state.settlements].sort((a, b) => (b.population || 0) - (a.population || 0))[0] || state.settlements[0];
            } else if (role === 'saint') {
                title = '성녀';
                if (!targetSettlement) targetSettlement = [...state.settlements].sort((a, b) => (a.population || 0) - (b.population || 0))[0] || state.settlements[0];
            } else if (role === 'emperor') {
                title = '황제';
                speed = 1;
                if (!targetSettlement && homeNationId) {
                    targetSettlement = state.settlements.filter(s => s.nationId === homeNationId).sort((a, b) => (b.population || 0) - (a.population || 0))[0] || null;
                }
                if (!targetSettlement) {
                    const topNation = sortedNations && sortedNations.length > 0 ? sortedNations[0] : null;
                    homeNationId = homeNationId || (topNation ? topNation.id : null);
                    if (homeNationId) {
                        targetSettlement = state.settlements.filter(s => s.nationId === homeNationId).sort((a, b) => (b.population || 0) - (a.population || 0))[0] || null;
                    }
                    if (!targetSettlement) targetSettlement = [...state.settlements].sort((a, b) => (b.population || 0) - (a.population || 0))[0] || state.settlements[0];
                }
            } else if (role === 'archmage') {
                title = '대마도사';
                speed = 2;
                if (!targetSettlement) targetSettlement = [...state.settlements].sort((a, b) => (b.culturePoints || 0) - (a.culturePoints || 0))[0] || state.settlements[0];
            } else if (role === 'grand_marshal') {
                title = '대원수';
                speed = 2;
                if (!targetSettlement) targetSettlement = [...state.settlements].sort((a, b) => (b.population || 0) - (a.population || 0))[0] || state.settlements[0];
            }

            if (!targetSettlement || !targetSettlement.tiles || targetSettlement.tiles.length <= 0) return null;
            npc.status = title;
            if (!String(npc.name || '').startsWith(`${title} `)) npc.name = `${title} ${npc.name}`;
            npc.location = {
                x: targetSettlement.tiles[0].x,
                y: targetSettlement.tiles[0].y
            };

            const figure = {
                npcId: npc.id,
                role,
                title,
                homeNationId,
                location: {
                    x: npc.location.x,
                    y: npc.location.y
                },
                destinationSettlementId: targetSettlement.id,
                speed
            };
            if (role === 'hero') {
                figure.companionNpcIds = [];
                figure.recruitmentResolved = false;
                figure.recruitAttemptedNpcIds = [];
            }
            getHistoryMajorFigures().push(figure);
            state.history.logs.unshift(`[${currentYear}년] 🏛️ [주요 인물] ${npc.name}이(가) 역사 무대에 등장했습니다.`);
            return figure;
        }

        function getNationSnapshotMap(sortedNations = [], tileCounts = {}) {
            const map = {};
            sortedNations.forEach(n => {
                const settlements = state.settlements.filter(s => s.nationId === n.id);
                const pop = settlements.reduce((sum, s) => sum + (s.population || 0), 0);
                const territory = tileCounts[n.id] || 0;
                const power = (territory * 1.4) + (settlements.length * 95) + (pop * 0.18);
                map[n.id] = {
                    nation: n,
                    territory,
                    settlementCount: settlements.length,
                    population: pop,
                    power,
                    settlements
                };
            });
            return map;
        }

        function maybeSpawnSaint(currentYear, sortedNations = []) {
            if (hasMajorFigureRole('saint')) return;
            if (!state.settlements || state.settlements.length < 3) return;
            const distressed = state.settlements.filter(s => (s.population || 0) < 130 || ((s.foodProduction || 0) < (s.foodConsumption || 0)));
            if (distressed.length < Math.max(3, Math.floor(state.settlements.length * 0.25))) return;
            const target = distressed.sort((a, b) => (a.population || 0) - (b.population || 0))[0];
            createHistoryMajorFigure('saint', currentYear, sortedNations, {
                targetSettlement: target
            });
        }

        function maybePromoteEmperor(currentYear, sortedNations = [], nationSnapshotMap = {}) {
            if (hasMajorFigureRole('emperor')) return;
            const candidates = Object.values(nationSnapshotMap).filter(s => s.territory >= 240 && s.settlementCount >= 3 && s.power >= 850);
            if (candidates.length <= 0) return;
            const chosen = candidates.sort((a, b) => b.power - a.power)[0];
            const nation = chosen.nation;
            if (!nation) return;
            nation.name = nation.name.includes('제국') ? nation.name : `${nation.name} 제국`;

            let ruler = getLeaderEntity(nation.rulerId);
            if (!ruler) {
                ruler = createRandomNPC();
                nation.rulerId = ruler.id;
            }
            ruler.status = '황제';
            const target = chosen.settlements.sort((a, b) => (b.population || 0) - (a.population || 0))[0] || state.settlements[0];
            createHistoryMajorFigure('emperor', currentYear, sortedNations, {
                existingNpc: ruler,
                homeNationId: nation.id,
                targetSettlement: target
            });
            state.history.logs.unshift(`[${currentYear}년] 👑 [제국 승격] ${nation.name}이(가) 제국으로 승격하고 ${ruler.name}이(가) 황제로 추대되었습니다.`);
        }

        function maybeSpawnAdditionalImportantFigures(currentYear, sortedNations = []) {
            const totalCulture = state.settlements.reduce((sum, s) => sum + (s.culturePoints || 0), 0);
            const topNation = sortedNations[0];
            const secondNation = sortedNations[1];
            const topGap = (topNation && secondNation) ? Math.abs((topNation.count || 0) - (secondNation.count || 0)) : 9999;

            if (!hasMajorFigureRole('archmage') && state.settlements.length >= 5 && totalCulture >= 420) {
                createHistoryMajorFigure('archmage', currentYear, sortedNations);
            }
            if (!hasMajorFigureRole('grand_marshal') && topNation && secondNation && (secondNation.count || 0) >= 85 && topGap <= 110) {
                createHistoryMajorFigure('grand_marshal', currentYear, sortedNations);
            }
        }

        function evaluateConditionalMajorFigureSpawns(currentYear, sortedNations = [], tileCounts = {}) {
            const nationSnapshotMap = getNationSnapshotMap(sortedNations, tileCounts);
            maybeSpawnSaint(currentYear, sortedNations);
            maybePromoteEmperor(currentYear, sortedNations, nationSnapshotMap);
            maybeSpawnAdditionalImportantFigures(currentYear, sortedNations);
        }

        function findNearestFigureForRecruitment(heroFigure) {
            const others = getHistoryMajorFigures().filter(f => f.npcId !== heroFigure.npcId && !heroFigure.recruitAttemptedNpcIds.includes(f.npcId));
            if (others.length <= 0) return null;
            let best = null;
            let bestDist = Infinity;
            others.forEach(f => {
                const dist = Math.abs((f.location?.x || 0) - heroFigure.location.x) + Math.abs((f.location?.y || 0) - heroFigure.location.y);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = f;
                }
            });
            return best;
        }

        function attemptHeroRecruitment(heroFigure, candidateFigure, currentYear) {
            if (!heroFigure || !candidateFigure) return false;
            const heroNpc = state.npcs.find(n => n.id === heroFigure.npcId);
            const candNpc = state.npcs.find(n => n.id === candidateFigure.npcId);
            if (!heroNpc || !candNpc) return false;

            const affinity = getSexCompatibility(heroNpc, candNpc);
            let baseChance = 0.35;
            if (candidateFigure.role === 'saint') baseChance = 0.58;
            else if (candidateFigure.role === 'archmage') baseChance = 0.66;
            else if (candidateFigure.role === 'grand_marshal') baseChance = 0.72;
            else if (candidateFigure.role === 'emperor') baseChance = 0.26;
            const chance = Math.max(0.05, Math.min(0.95, baseChance + ((affinity - 50) / 250)));

            const joined = Math.random() < chance;
            heroFigure.recruitAttemptedNpcIds.push(candidateFigure.npcId);
            if (joined) {
                if (!heroFigure.companionNpcIds.includes(candidateFigure.npcId)) heroFigure.companionNpcIds.push(candidateFigure.npcId);
                state.history.logs.unshift(`[${currentYear}년] 🤝 [용사단] ${candNpc.name}이(가) 용사단에 합류했습니다. (상성 ${affinity})`);
            } else {
                state.history.logs.unshift(`[${currentYear}년] 🚪 [용사단] ${candNpc.name}이(가) 제안을 거절했습니다. (상성 ${affinity})`);
            }
            return joined;
        }

        function chooseDestinationForFigure(figure, sortedNations = []) {
            if (!state.settlements || state.settlements.length <= 0) return null;
            if (figure.role === 'hero') {
                if (!figure.recruitmentResolved) {
                    const recruitTarget = findNearestFigureForRecruitment(figure);
                    if (recruitTarget) {
                        const near = findNearestSettlementPosition(recruitTarget.location.x, recruitTarget.location.y);
                        if (near && near.settlement) return near.settlement;
                    } else {
                        figure.recruitmentResolved = true;
                    }
                }
                const o = getOtherworldState();
                if (o.active) {
                    const aliveCore = o.cores.find(c => c.alive);
                    if (aliveCore) {
                        const nearest = findNearestSettlementPosition(aliveCore.x, aliveCore.y);
                        if (nearest && nearest.settlement) return nearest.settlement;
                    }
                }
                const t = getHistoryThreatState();
                if (t.demonLord.active && t.demonLord.castle) {
                    const nearCastle = findNearestSettlementPosition(t.demonLord.castle.x, t.demonLord.castle.y);
                    if (nearCastle && nearCastle.settlement) return nearCastle.settlement;
                }
                if (t.dragon.active && t.dragon.nest) {
                    const nearNest = findNearestSettlementPosition(t.dragon.nest.x, t.dragon.nest.y);
                    if (nearNest && nearNest.settlement) return nearNest.settlement;
                }
                return [...state.settlements].sort((a, b) => (b.population || 0) - (a.population || 0))[0] || state.settlements[0];
            }

            if (figure.role === 'saint') {
                return [...state.settlements].sort((a, b) => (a.population || 0) - (b.population || 0))[0] || state.settlements[0];
            }

            if (figure.role === 'archmage') {
                const o = getOtherworldState();
                if (o.active) {
                    const core = o.cores.find(c => c.alive);
                    if (core) {
                        const nearCore = findNearestSettlementPosition(core.x, core.y);
                        if (nearCore && nearCore.settlement) return nearCore.settlement;
                    }
                }
                return [...state.settlements].sort((a, b) => (b.culturePoints || 0) - (a.culturePoints || 0))[0] || state.settlements[0];
            }

            if (figure.role === 'grand_marshal') {
                const t = getHistoryThreatState();
                if (t.demonLord.active && t.demonLord.castle) {
                    const nearCastle = findNearestSettlementPosition(t.demonLord.castle.x, t.demonLord.castle.y);
                    if (nearCastle && nearCastle.settlement) return nearCastle.settlement;
                }
                return [...state.settlements].sort((a, b) => (b.population || 0) - (a.population || 0))[0] || state.settlements[0];
            }

            if (figure.role === 'emperor') {
                if (figure.homeNationId) {
                    const nationalCapital = state.settlements.filter(s => s.nationId === figure.homeNationId).sort((a, b) => (b.population || 0) - (a.population || 0))[0];
                    if (nationalCapital) return nationalCapital;
                }
                const topNation = sortedNations && sortedNations.length > 0 ? sortedNations[0] : null;
                if (topNation) {
                    const topNationSettlement = state.settlements.filter(s => s.nationId === topNation.id).sort((a, b) => (b.population || 0) - (a.population || 0))[0];
                    if (topNationSettlement) {
                        figure.homeNationId = topNation.id;
                        return topNationSettlement;
                    }
                }
                return [...state.settlements].sort((a, b) => (b.population || 0) - (a.population || 0))[0] || state.settlements[0];
            }

            return state.settlements[Math.floor(Math.random() * state.settlements.length)];
        }

        function moveFigureToward(figure, destinationSettlement) {
            if (!destinationSettlement || !destinationSettlement.tiles || destinationSettlement.tiles.length <= 0) return false;
            const target = destinationSettlement.tiles[0];
            for (let i = 0; i < figure.speed; i++) {
                const dx = target.x - figure.location.x;
                const dy = target.y - figure.location.y;
                if (dx === 0 && dy === 0) break;
                if (Math.abs(dx) >= Math.abs(dy)) figure.location.x += Math.sign(dx);
                else figure.location.y += Math.sign(dy);
            }
            const npc = state.npcs.find(n => n.id === figure.npcId);
            if (npc) npc.location = {
                x: figure.location.x,
                y: figure.location.y
            };
            return figure.location.x === target.x && figure.location.y === target.y;
        }

        function applyMajorFigureArrivalEffects(figure, destinationSettlement, currentYear) {
            if (!destinationSettlement) return;
            if (figure.role === 'hero') {
                if (!figure.recruitmentResolved) {
                    const recruitCandidate = getHistoryMajorFigures().find(f => {
                        if (f.npcId === figure.npcId) return false;
                        if (figure.recruitAttemptedNpcIds.includes(f.npcId)) return false;
                        const dist = Math.abs((f.location?.x || 0) - figure.location.x) + Math.abs((f.location?.y || 0) - figure.location.y);
                        return dist <= 2;
                    });
                    if (recruitCandidate) {
                        attemptHeroRecruitment(figure, recruitCandidate, currentYear);
                        return;
                    }
                    if (!findNearestFigureForRecruitment(figure)) {
                        figure.recruitmentResolved = true;
                        state.history.logs.unshift(`[${currentYear}년] 🛡️ [용사단] 모집을 마친 용사단이 위협 전선으로 출정합니다.`);
                    }
                }

                const companionBonus = (figure.companionNpcIds?.length || 0) * 0.12;
                const o = getOtherworldState();
                const core = o.cores.find(c => c.alive && Math.abs(c.x - figure.location.x) + Math.abs(c.y - figure.location.y) <= 3);
                if (core) {
                    if (Math.random() < (0.45 + companionBonus)) {
                        destroyOtherworldCore(core, currentYear, 'settlement_defense');
                        state.history.logs.unshift(`[${currentYear}년] ⚔️ [용사단] 용사단이 전선을 돌파해 이계 중심핵을 파괴했습니다.`);
                    } else {
                        state.history.logs.unshift(`[${currentYear}년] ⚔️ [용사단] 이계 핵 공략에 실패했지만 전선을 유지했습니다.`);
                    }
                    return;
                }
                const t = getHistoryThreatState();
                if (t.demonLord.bands.length > 0) {
                    const kills = Math.max(1, Math.min(t.demonLord.bands.length, 1 + Math.floor((figure.companionNpcIds?.length || 0) / 2)));
                    t.demonLord.bands.splice(0, kills);
                    state.history.logs.unshift(`[${currentYear}년] ⚔️ [용사단] 용사단이 마왕군 ${kills}개 부대를 격퇴했습니다.`);
                    return;
                }
                if (t.dragon.active) {
                    t.dragon.nextRaidTurn += Math.floor(t.dragon.cooldownTurns * (0.5 + companionBonus));
                    state.history.logs.unshift(`[${currentYear}년] 🛡️ [용사단] 용사단의 교란으로 드래곤의 공세가 지연되었습니다.`);
                }
                return;
            }

            if (figure.role === 'saint') {
                const heal = Math.max(6, Math.floor((destinationSettlement.population || 0) * (0.08 + Math.random() * 0.07)));
                destinationSettlement.population += heal;
                destinationSettlement.culturePoints = (destinationSettlement.culturePoints || 0) + 40;
                checkSettlementUpgrades(destinationSettlement);
                state.history.logs.unshift(`[${currentYear}년] ✨ [주요 인물] 성녀가 ${destinationSettlement.name}의 민심을 수습해 인구가 ${heal} 증가했습니다.`);
                return;
            }

            if (figure.role === 'emperor') {
                const boostTargets = state.settlements.filter(s => {
                    if (!figure.homeNationId) return false;
                    return s.nationId === figure.homeNationId;
                });
                const targets = boostTargets.length > 0 ? boostTargets : [destinationSettlement];
                targets.forEach(s => {
                    s.population += Math.max(4, Math.floor((s.population || 0) * 0.04));
                    s.culturePoints = (s.culturePoints || 0) + 20;
                    checkSettlementUpgrades(s);
                });
                state.history.logs.unshift(`[${currentYear}년] 👑 [주요 인물] 제국의 왕이 내정을 정비해 핵심 정착지들이 안정되었습니다.`);
                return;
            }

            if (figure.role === 'archmage') {
                const o = getOtherworldState();
                const core = o.cores.find(c => c.alive && Math.abs(c.x - figure.location.x) + Math.abs(c.y - figure.location.y) <= 4);
                if (core && Math.random() < 0.55) {
                    destroyOtherworldCore(core, currentYear, 'settlement_defense');
                    state.history.logs.unshift(`[${currentYear}년] 🔮 [주요 인물] 대마도사가 봉인술로 이계 핵 하나를 무력화했습니다.`);
                } else {
                    destinationSettlement.culturePoints = (destinationSettlement.culturePoints || 0) + 60;
                    state.history.logs.unshift(`[${currentYear}년] 🔮 [주요 인물] 대마도사가 결계를 강화해 침식 확산을 지연시켰습니다.`);
                }
                return;
            }

            if (figure.role === 'grand_marshal') {
                const t = getHistoryThreatState();
                if (t.demonLord.bands.length > 0) {
                    t.demonLord.bands.shift();
                    state.history.logs.unshift(`[${currentYear}년] 🪖 [주요 인물] 대원수가 마왕군 부대를 요격했습니다.`);
                } else {
                    destinationSettlement.population += Math.max(4, Math.floor((destinationSettlement.population || 0) * 0.03));
                    state.history.logs.unshift(`[${currentYear}년] 🪖 [주요 인물] 대원수가 방위선을 재정비해 ${destinationSettlement.name}의 방어가 강화되었습니다.`);
                }
            }
        }

        function processHistoryMajorFiguresTurn(currentYear, sortedNations = []) {
            const figures = getHistoryMajorFigures();
            figures.forEach(figure => {
                const destination = chooseDestinationForFigure(figure, sortedNations);
                if (!destination) return;
                figure.destinationSettlementId = destination.id;
                const arrived = moveFigureToward(figure, destination);
                if (arrived) applyMajorFigureArrivalEffects(figure, destination, currentYear);
            });
        }

        function generateHistoryWorldEventChoices() {
            const threats = getHistoryThreatState();
            const otherworld = getOtherworldState();
            const heroChoiceAvailable = otherworld.active && threats.demonLord.active && threats.dragon.active && !hasMajorFigureRole('hero');

            const pool = [{
                    id: 'golden_age',
                    title: '황금기 선포',
                    icon: '🌞',
                    desc: '모든 정착지 인구가 크게 성장하고 문화가 꽃핍니다.',
                    color: 'amber',
                    rarity: 'common',
                    weight: 24
                },
                {
                    id: 'frontier_rush',
                    title: '개척 대행진',
                    icon: '🧭',
                    desc: '새로운 정착지가 빠르게 늘어나고 변방이 확장됩니다.',
                    color: 'emerald',
                    rarity: 'common',
                    weight: 22
                },
                {
                    id: 'iron_march',
                    title: '강철 행군',
                    icon: '⚔️',
                    desc: '국가 간 경쟁이 격화되어 군사적 긴장이 높아집니다.',
                    color: 'rose',
                    rarity: 'common',
                    weight: 20
                },
                {
                    id: 'sage_conclave',
                    title: '현자의 회합',
                    icon: '📚',
                    desc: '지도자와 인재가 늘어나 국가 운영이 안정됩니다.',
                    color: 'indigo',
                    rarity: 'rare',
                    weight: 13
                },
                {
                    id: 'mana_bloom',
                    title: '마나 개화',
                    icon: '✨',
                    desc: '자연과 신비가 활성화되어 숲과 비옥한 땅이 늘어납니다.',
                    color: 'violet',
                    rarity: 'rare',
                    weight: 11
                },
                {
                    id: 'demon_lord_descends',
                    title: '마왕 강림',
                    icon: '👑',
                    desc: '대륙 전역에 어둠의 군세가 출몰하고 문명권이 흔들립니다.',
                    color: 'fuchsia',
                    rarity: 'epic',
                    weight: 6
                },
                {
                    id: 'dragon_wrath',
                    title: '드래곤의 분노',
                    icon: '🐉',
                    desc: '용의 습격으로 주요 정착지가 파괴되고 생존 경쟁이 시작됩니다.',
                    color: 'red',
                    rarity: 'epic',
                    weight: 5
                },
                {
                    id: 'otherworldly_erosion',
                    title: '이계 침식',
                    icon: '🌀',
                    desc: '균열이 열리며 대지가 변이하고 마나 폭주가 발생합니다.',
                    color: 'purple',
                    rarity: 'legendary',
                    weight: 3
                }
            ];
            if (heroChoiceAvailable) {
                pool.push({
                    id: 'hero_appears',
                    title: '용사 출현',
                    icon: '🗡️',
                    desc: '삼중 재앙 앞에 맞설 용사가 나타나 전선에 개입합니다.',
                    color: 'sky',
                    rarity: 'rare',
                    weight: 9
                });
            }
            const candidates = [...pool];
            const picks = [];
            while (candidates.length > 0 && picks.length < 3) {
                const totalWeight = candidates.reduce((sum, item) => sum + (item.weight || 1), 0);
                let roll = Math.random() * totalWeight;
                let chosenIndex = 0;
                for (let i = 0; i < candidates.length; i++) {
                    roll -= (candidates[i].weight || 1);
                    if (roll <= 0) {
                        chosenIndex = i;
                        break;
                    }
                }
                picks.push(candidates.splice(chosenIndex, 1)[0]);
            }
            return picks;
        }

        function applyHistoryWorldEventChoice(choiceId) {
            if (!choiceId) return;
            const currentYear = state.gameDate.year + state.history.currentTurn;
            if (choiceId === 'golden_age') {
                state.settlements.forEach(s => {
                    const bonus = Math.floor(s.population * (0.12 + Math.random() * 0.13));
                    s.population += Math.max(8, bonus);
                    checkSettlementUpgrades(s);
                });
                state.history.logs.unshift(`[${currentYear}년] 🌞 [월드 이벤트] 황금기가 도래하여 정착지 인구가 폭발적으로 증가했습니다.`);
            } else if (choiceId === 'frontier_rush') {
                let spawned = 0;
                for (let i = 0; i < 4; i++) {
                    let validTiles = [];
                    state.worldMap.forEach(row => row.forEach(t => {
                        if ((t.type === 'grass' || t.type === 'forest') && !t.settlementId && !t.influencedBy) validTiles.push(t);
                    }));
                    if (validTiles.length <= 0) break;
                    let t = validTiles[Math.floor(Math.random() * validTiles.length)];
                    const settlement = createSettlement(generateSettlementName(), t.x, t.y, null, Math.floor(Math.random() * 220) + 60);
                    if (settlement) spawned++;
                }
                state.history.logs.unshift(`[${currentYear}년] 🧭 [월드 이벤트] 개척 대행진으로 ${spawned}개의 신규 정착지가 건설되었습니다.`);
            } else if (choiceId === 'iron_march') {
                state.history.nations.forEach(n => {
                    if (Math.random() < 0.6) n.color = generateNationColor();
                });
                state.settlements.forEach(s => {
                    if (s.nationId && Math.random() < 0.45) {
                        s.population = Math.max(30, Math.floor(s.population * (0.9 + Math.random() * 0.06)));
                    }
                });
                state.history.logs.unshift(`[${currentYear}년] ⚔️ [월드 이벤트] 강철 행군으로 군사 경쟁이 격화되고 국경 분쟁이 빈발했습니다.`);
            } else if (choiceId === 'sage_conclave') {
                state.settlements.forEach(s => {
                    if ((s.type === 'town' || s.type === 'city' || s.type === 'metropolis') && !s.leaderId) {
                        const newLeader = createRandomNPC();
                        newLeader.location = {
                            x: s.tiles[0].x,
                            y: s.tiles[0].y
                        };
                        s.leaderId = newLeader.id;
                    }
                    s.population += Math.floor(Math.random() * 25);
                });
                state.history.logs.unshift(`[${currentYear}년] 📚 [월드 이벤트] 현자의 회합으로 각지에 유능한 지도자들이 등장했습니다.`);
            } else if (choiceId === 'mana_bloom') {
                for (let y = 0; y < MAP_SIZE; y++) {
                    for (let x = 0; x < MAP_SIZE; x++) {
                        const tile = state.worldMap[y][x];
                        if ((tile.type === 'grass' || tile.type === 'forest') && Math.random() < 0.02) {
                            tile.type = Math.random() < 0.5 ? 'magic_grass' : 'forest';
                        }
                    }
                }
                state.history.logs.unshift(`[${currentYear}년] ✨ [월드 이벤트] 마나 개화로 대륙 곳곳의 대지가 신비로운 기운을 머금었습니다.`);
            } else if (choiceId === 'demon_lord_descends') {
                activateDemonLordThreat(currentYear);
                state.history.logs.unshift(`[${currentYear}년] 👑 [월드 이벤트] 마왕성이 세워지고 주기적으로 적대적 무리가 출병하기 시작했습니다.`);
            } else if (choiceId === 'dragon_wrath') {
                activateDragonThreat(currentYear);
                state.history.logs.unshift(`[${currentYear}년] 🐉 [월드 이벤트] 드래곤이 둥지를 틀고 가장 가까운 정착지를 반복 습격하기 시작했습니다.`);
            } else if (choiceId === 'otherworldly_erosion') {
                activateOtherworldErosion(currentYear);
                state.history.logs.unshift(`[${currentYear}년] 🌀 [월드 이벤트] 이계 중심핵이 출현해 턴마다 침식이 확산되기 시작했습니다.`);
            } else if (choiceId === 'hero_appears') {
                if (!hasMajorFigureRole('hero')) {
                    createHistoryMajorFigure('hero', currentYear);
                    state.history.logs.unshift(`[${currentYear}년] 🗡️ [월드 이벤트] 삼중 재앙에 맞서 용사가 공식적으로 전선에 합류했습니다.`);
                } else {
                    state.history.logs.unshift(`[${currentYear}년] 🗡️ [월드 이벤트] 용사는 이미 전선에서 활약 중입니다.`);
                }
            }
        }

        function pickHistoryChronicleEvent(sortedNations, topNation, secondNation, startYear, endYear) {
            const events = [{
                    id: 'dark_age',
                    weight: (topNation && topNation.count === 0) ? 35 : 0,
                    log: `[${startYear}~${endYear}년] 대륙 전역이 야만족과 마물들에 의해 짓밟혀 암흑기가 도래했습니다.`
                },
                {
                    id: 'territory_war',
                    weight: (secondNation && secondNation.count > 100) ? 24 : 8,
                    log: topNation && secondNation ? `[${startYear}~${endYear}년] <strong>${topNation.name}</strong>과(와) <strong>${secondNation.name}</strong> 간의 처절한 영토 전쟁이 대륙을 피로 물들였습니다.` : `[${startYear}~${endYear}년] 군벌과 제후들이 난립하며 대륙의 국경이 끊임없이 요동쳤습니다.`
                },
                {
                    id: 'imperial_expansion',
                    weight: topNation ? 20 : 10,
                    log: topNation ? `[${startYear}~${endYear}년] <strong>${topNation.name}</strong>이(가) 급격히 영토를 넓히며 대륙의 황금기를 주도했습니다.` : `[${startYear}~${endYear}년] 강력한 중심 세력이 부재한 가운데 소국들의 흥망이 반복되었습니다.`
                },
                {
                    id: 'famine',
                    weight: 9,
                    settlementModifiers: {
                        foodMultiplier: 0.5,
                        popLossRate: 0.06
                    },
                    log: `[${startYear}~${endYear}년] 대흉년이 들며 수확량이 반토막 나고 굶주림이 확산되었습니다.`
                },
                {
                    id: 'plague',
                    weight: 8,
                    settlementModifiers: {
                        foodMultiplier: 0.85,
                        popLossRate: 0.12
                    },
                    log: `[${startYear}~${endYear}년] 치명적인 역병이 퍼져 도시와 촌락의 인구가 급감했습니다.`
                },
                {
                    id: 'drought',
                    weight: 7,
                    settlementModifiers: {
                        foodMultiplier: 0.6,
                        popLossRate: 0.03
                    },
                    log: `[${startYear}~${endYear}년] 장기 가뭄이 이어지며 농경지와 수자원이 큰 타격을 입었습니다.`
                },
                {
                    id: 'renaissance',
                    weight: 10,
                    log: `[${startYear}~${endYear}년] 학문과 예술이 번성하는 르네상스가 도래해 문화적 전성기가 열렸습니다.`
                },
                {
                    id: 'trade_boom',
                    weight: 12,
                    log: `[${startYear}~${endYear}년] 대상단과 항로 개척이 활발해지며 각국의 무역과 부가 빠르게 성장했습니다.`
                },
                {
                    id: 'genius_birth',
                    weight: 10,
                    log: (() => {
                        let randomNation = sortedNations[Math.floor(Math.random() * Math.min(3, sortedNations.length))];
                        if (randomNation && randomNation.count > 0) return `[${startYear}~${endYear}년] <strong>${randomNation.name}</strong>에서 세기의 천재가 탄생하여 역사에 거대한 족적을 남겼습니다.`;
                        return `[${startYear}~${endYear}년] 잊혀진 부족들의 잔당이 끊임없이 국경을 어지럽혔습니다.`;
                    })()
                }
            ];

            const candidates = events.filter(e => (e.weight || 0) > 0);
            const totalWeight = candidates.reduce((sum, item) => sum + item.weight, 0);
            let roll = Math.random() * totalWeight;
            for (let i = 0; i < candidates.length; i++) {
                roll -= candidates[i].weight;
                if (roll <= 0) return candidates[i];
            }
            return candidates[candidates.length - 1];
        }

        function finalizeHistorySimulation() {
            if (state.history.isFinished) return;
            if (state.history.intervalId) clearTimeout(state.history.intervalId);
            state.history.intervalId = null;
            state.history.isRunning = false;
            state.history.isPaused = false;
            state.history.isPausedForEvent = false;
            state.history.pendingWorldEventChoices = [];
            state.history.isFinished = true;

            state.history.logs.unshift("[시스템] 대륙에 고대 도로망이 형성되었습니다...");
            generateRoadNetworks();
            state.gameDate.year += state.history.currentTurn;
            state.gameDate.month = 3;
            state.gameDate.week = 1;
            for (let i = 0; i < 400; i++) {
                let npc = createRandomNPC();
                if (state.settlements.length > 0) {
                    let s = state.settlements[Math.floor(Math.random() * state.settlements.length)];
                    npc.location = {
                        x: s.tiles[0].x,
                        y: s.tiles[0].y
                    };
                }
            }
            state.npcs.forEach(npc => {
                if (!npc.location && state.settlements.length > 0) {
                    let s = state.settlements[Math.floor(Math.random() * state.settlements.length)];
                    npc.location = {
                        x: s.tiles[0].x,
                        y: s.tiles[0].y
                    };
                }
            });
            renderHistoryUI();
        }

        function stepHistorySimulation() {
            if (!state.history.isRunning || state.history.isFinished || state.history.isPaused || state.history.isPausedForEvent) return;
            const chunk = 10;
            const currentYear = state.gameDate.year + state.history.currentTurn;
            let tileCounts = {};
            state.history.nations.forEach(n => tileCounts[n.id] = 0);
            state.worldMap.forEach(row => row.forEach(t => {
                if (t.nationId) tileCounts[t.nationId]++;
            }));
            let sortedNations = state.history.nations.map(n => ({
                ...n,
                count: tileCounts[n.id]
            })).sort((a, b) => b.count - a.count);
            let topNation = sortedNations[0];
            let secondNation = sortedNations[1];
            let startYear = currentYear,
                endYear = currentYear + chunk - 1;
            const chronicleEvent = pickHistoryChronicleEvent(sortedNations, topNation, secondNation, startYear, endYear);

            processHistorySettlements(chunk, chronicleEvent.settlementModifiers || null);
            processOtherworldErosionTurn(endYear);
            processHistoryThreatsTurn(endYear);
            evaluateConditionalMajorFigureSpawns(endYear, sortedNations, tileCounts);
            processHistoryMajorFiguresTurn(endYear, sortedNations);
            updateSettlementInfluences();
            updateNationBordersFromInfluence();

            const logMsg = chronicleEvent.log;
            state.history.logs.unshift(logMsg);
            if (typeof showToast === 'function') {
                const toastMsg = String(logMsg).replace(/<[^>]*>/g, '');
                showToast(toastMsg, false, {
                    variant: 'history-log',
                    durationMs: 700,
                    fadeOutMs: 250
                });
            }
            state.history.currentTurn += chunk;
            renderHistoryUI();

            if (state.history.isRunning && !state.history.isPaused && !state.history.isPausedForEvent) {
                state.history.intervalId = setTimeout(stepHistorySimulation, state.history.turnIntervalMs || 700);
            }
        }

        function chooseHistoryWorldEvent(choiceId) {
            if (!state.history.isPausedForEvent || state.history.isFinished) return;
            applyHistoryWorldEventChoice(choiceId);
            state.history.pendingWorldEventChoices = [];
            state.history.isPausedForEvent = false;
            renderHistoryUI();
            if (state.history.isRunning && !state.history.isPaused) {
                state.history.intervalId = setTimeout(stepHistorySimulation, state.history.turnIntervalMs || 700);
            }
        }

        // ==========================================
        // 10. 캔버스 렌더링
        // ==========================================
        function drawCityMap(resetCenter = false) {
            const canvas = document.getElementById('city-canvas');
            if (!canvas || !state.player.location) return;
            const currentTile = state.worldMap[state.player.location.y][state.player.location.x];
            const s = state.settlements.find(sett => sett.id === currentTile.settlementId);
            if (!s || !s.layoutData) return;
            const ctx = canvas.getContext('2d');
            // 자동 맞춤 모드면 현재 패널 크기에 맞게 타일 크기 조정
            if (state.cityMapAutoFit) {
                fitCityMapToView();
            }
            const cSize = state.cityTileSize || 20;
             // 도시 지도용 컬러 팔레트 (가독성 + 통일감)
             const CITY_TILE_COLORS = {
                 wild: '#0b1220',
                 water: '#1d4ed8',
                 ice: '#e0f2fe',
                 rock: '#4b5563',
                 dirt: '#7c5c3f',
                 grass: '#2f6b3f',
                 dark_grass: '#1f4d2a',
                 magic_grass: '#0f766e',
                 sand: '#e7c86a',
                 snow: '#f8fafc',
                 road: '#6b4f3f',
                 building: '#475569'
             };
             // 주요 시설 색상 분리 (건물이 모두 같은 색으로 보이는 문제 완화)
             const CITY_BUILDING_COLORS = {
                 castle: '#9ca3af',
                 manor: '#a8a29e',
                 town_hall: '#8b5e3c',
                 guild_office: '#6b7280',
                 market: '#b45309',
                 bank: '#a16207',
                 blacksmith: '#7f1d1d',
                 arena: '#7c2d12',
                 dojo: '#7f1d1d',
                 training_ground: '#4b5563',
                 mage_tower: '#6d28d9',
                 library: '#1e3a8a',
                 temple: '#c2410c',
                 shrine: '#f59e0b',
                 church: '#e2e8f0',
                 house: '#7c3e22',
                 hut: '#5b3a1e',
                 farm: '#4d7c0f',
                 well: '#0f766e',
                 campfire: '#dc2626',
                 noticeboard: '#78350f',
                 inn: '#92400e',
                 tavern: '#92400e',
                 dock: '#1f2937',
                 shipyard: '#3f4c6b'
             };
             const gw = s.layoutData.gw;
             const gh = s.layoutData.gh;
             canvas.width = gw * cSize;
             canvas.height = gh * cSize;
 
             ctx.clearRect(0, 0, canvas.width, canvas.height);
             for (let y = 0; y < gh; y++) {
                 for (let x = 0; x < gw; x++) {
                     let tileType = s.layoutData.grid[y][x];
                     let px = x * cSize;
                     let py = y * cSize;
                     ctx.fillStyle = CITY_TILE_COLORS[tileType] || CITY_TILE_COLORS.wild;
                     ctx.fillRect(px, py, cSize, cSize);
 
                     // 타일 입체감(과하지 않게)
                     if (cSize >= 6) {
                         const lightH = Math.max(1, Math.floor(cSize * 0.12));
                         const darkH = Math.max(1, Math.floor(cSize * 0.10));
                         ctx.fillStyle = 'rgba(255,255,255,0.04)';
                         ctx.fillRect(px, py, cSize, lightH);
                         ctx.fillStyle = 'rgba(0,0,0,0.08)';
                         ctx.fillRect(px, py + cSize - darkH, cSize, darkH);
                     }
 
                     // 길은 테두리를 살짝 강조
                     if (tileType === 'road' && cSize >= 8) {
                         ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                         ctx.lineWidth = 1;
                         ctx.strokeRect(px + 1, py + 1, cSize - 2, cSize - 2);
                     }
                 }
             }
 
             // 격자선은 충분히 확대했을 때만
             if (cSize >= 12) {
                 ctx.strokeStyle = 'rgba(0,0,0,0.08)';
                 ctx.lineWidth = 1;
                 for (let i = 0; i <= gw; i++) {
                     ctx.beginPath();
                     ctx.moveTo(i * cSize, 0);
                     ctx.lineTo(i * cSize, canvas.height);
                     ctx.stroke();
                 }
                 for (let i = 0; i <= gh; i++) {
                     ctx.beginPath();
                     ctx.moveTo(0, i * cSize);
                     ctx.lineTo(canvas.width, i * cSize);
                     ctx.stroke();
                 }
             }
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             s.layoutData.instances.forEach(inst => {
                 let px = inst.x * cSize;
                 let py = inst.y * cSize;
                 let w = inst.w * cSize;
                 let h = inst.h * cSize;
                 const fac = BUILDINGS[inst.type];
                 const bColor = CITY_BUILDING_COLORS[inst.type] || '#475569';
                 ctx.save();
                 ctx.fillStyle = bColor;
                 ctx.shadowColor = 'rgba(0,0,0,0.35)';
                 ctx.shadowBlur = Math.max(2, Math.floor(cSize * 0.15));
                 ctx.fillRect(px + 1, py + 1, w - 2, h - 2);
                 ctx.restore();
 
                 ctx.strokeStyle = 'rgba(0,0,0,0.45)';
                 ctx.lineWidth = 2;
                 ctx.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);
                 ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                 ctx.lineWidth = 1;
                 ctx.strokeRect(px + 2, py + 2, w - 4, h - 4);
 
                 if (state.selectedFacility && state.selectedFacility.id === inst.id) {
                     ctx.save();
                     ctx.strokeStyle = '#fbbf24';
                     ctx.lineWidth = 3;
                     ctx.shadowColor = 'rgba(251,191,36,0.6)';
                     ctx.shadowBlur = 8;
                     ctx.strokeRect(px + 2, py + 2, w - 4, h - 4);
                     ctx.fillStyle = 'rgba(251,191,36,0.18)';
                     ctx.fillRect(px + 1, py + 1, w - 2, h - 2);
                     ctx.restore();
                 }
 
                 if (fac && cSize >= 10) {
                     let iconSize = Math.min(inst.w, inst.h) * cSize * 0.55;
                     iconSize = Math.max(12, Math.min(54, iconSize));
                     const cx = px + w / 2;
                     const cy = py + h / 2;
 
                     // 아이콘 가독성용 배경 원
                     ctx.fillStyle = 'rgba(15,23,42,0.35)';
                     ctx.beginPath();
                     ctx.arc(cx, cy, Math.max(10, iconSize * 0.6), 0, Math.PI * 2);
                     ctx.fill();
 
                     ctx.font = `${iconSize}px Arial`;
                     ctx.shadowColor = 'rgba(0,0,0,0.8)';
                     ctx.shadowBlur = 4;
                     ctx.fillText(fac.icon, cx, cy);
                     ctx.shadowBlur = 0;
                 }
             });

            const wrapper = document.getElementById('city-map-wrapper');
            if (wrapper && !wrapper.dataset.hasEvents) {
                let startX, startY, scrollLeft, scrollTop;
                let isMapPointerDown = false; // 💡 외부 클릭과 분리하기 위한 식별자

                wrapper.onmousedown = (e) => {
                    isDraggingMap = false;
                    isMapPointerDown = true; // 맵 위에서 클릭이 시작됨을 기록
                    startX = e.pageX - wrapper.offsetLeft;
                    startY = e.pageY - wrapper.offsetTop;
                    scrollLeft = wrapper.scrollLeft;
                    scrollTop = wrapper.scrollTop;
                    wrapper.style.cursor = 'grabbing';
                };
                wrapper.onmouseleave = () => {
                    isMapPointerDown = false;
                    isDraggingMap = false;
                    wrapper.style.cursor = 'grab';
                };
                wrapper.onmouseup = () => {
                    isMapPointerDown = false;
                    wrapper.style.cursor = 'grab';
                    setTimeout(() => {
                        isDraggingMap = false;
                    }, 50);
                };
                wrapper.onmousemove = (e) => {
                    // 💡 드래그가 맵 바깥(툴바 등)에서 시작되었다면 맵 이동을 무시
                    if (e.buttons !== 1 || !isMapPointerDown) return;
                    e.preventDefault();
                    const x = e.pageX - wrapper.offsetLeft;
                    const y = e.pageY - wrapper.offsetTop;
                    const walkX = (x - startX) * 1.5;
                    const walkY = (y - startY) * 1.5;
                    if (Math.abs(walkX) > 5 || Math.abs(walkY) > 5) isDraggingMap = true;
                    wrapper.scrollLeft = scrollLeft - walkX;
                    wrapper.scrollTop = scrollTop - walkY;
                };

                wrapper.onclick = (e) => {
                    if (isDraggingMap) return;
                    // ... (이하 기존 onclick 로직 그대로 유지)
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const x = (e.clientX - rect.left) * scaleX;
                    const y = (e.clientY - rect.top) * scaleY;
                    const tx = Math.floor(x / state.cityTileSize);
                    const ty = Math.floor(y / state.cityTileSize);
                    let clickedInst = null;
                    for (let i = s.layoutData.instances.length - 1; i >= 0; i--) {
                        let inst = s.layoutData.instances[i];
                        if (tx >= inst.x && tx < inst.x + inst.w && ty >= inst.y && ty < inst.y + inst.h) {
                            clickedInst = inst;
                            break;
                        }
                    }
                    state.selectedFacility = clickedInst;
                    updateFacilityDetailPanel();
                    drawCityMap(false);
                };
                wrapper.dataset.hasEvents = "true";
            }
            if (resetCenter && wrapper) {
                setTimeout(() => {
                    let px = (state.player.location.x - s.layoutData.minX) * 50 + 25;
                    let py = (state.player.location.y - s.layoutData.minY) * 50 + 25;
                    wrapper.scrollLeft = (px * state.cityTileSize) - wrapper.clientWidth / 2;
                    wrapper.scrollTop = (py * state.cityTileSize) - wrapper.clientHeight / 2;
                }, 10);
            }
        }

        let baseMapCache = {
            canvas: null,
            ctx: null,
            tileSize: 0
        };

        let minimapCache = {
            canvas: null,
            size: 0,
            dirty: true
        };

        let minimapRaf = null;
        function scheduleMiniMapUpdate() {
            if (minimapRaf) return;
            minimapRaf = requestAnimationFrame(() => {
                minimapRaf = null;
                drawMiniMap();
            });
        }

        function rebuildBaseMapCache() {
            if (!state.worldMap) return;
            const fullSize = MAP_SIZE * state.tileSize;
            if (!baseMapCache.canvas) {
                baseMapCache.canvas = document.createElement('canvas');
                baseMapCache.ctx = baseMapCache.canvas.getContext('2d', { alpha: false });
            }
            if (baseMapCache.canvas.width !== fullSize) {
                baseMapCache.canvas.width = fullSize;
                baseMapCache.canvas.height = fullSize;
            }
            baseMapCache.tileSize = state.tileSize;

            const bctx = baseMapCache.ctx;
            bctx.fillStyle = '#0f172a';
            bctx.fillRect(0, 0, fullSize, fullSize);

            for (let y = 0; y < MAP_SIZE; y++) {
                for (let x = 0; x < MAP_SIZE; x++) {
                    const t = state.worldMap[y][x];
                    const px = x * state.tileSize;
                    const py = y * state.tileSize;
                    const ts = state.tileSize;

                    // Base terrain only (static)
                    bctx.fillStyle = t.color;
                    bctx.fillRect(px, py, ts, ts);

                    if (t.type === 'world_tree') {
                        bctx.fillStyle = '#fef08a';
                        bctx.beginPath();
                        bctx.arc(px + ts / 2, py + ts / 2, ts / 3, 0, Math.PI * 2);
                        bctx.fill();
                    }
                }
            }
        }

        function drawCanvasMap(resetCenter = false) {
            const canvas = document.getElementById('world-canvas');
            const playerCanvas = document.getElementById('player-canvas');
            const wrapper = document.getElementById('map-wrapper');
            if (!canvas || !playerCanvas || !state.worldMap || !wrapper) return;

            const ctx = canvas.getContext('2d', {
                alpha: false
            });
            const fullSize = MAP_SIZE * state.tileSize;

            if (canvas.width !== fullSize) {
                canvas.width = fullSize;
                canvas.height = fullSize;
                playerCanvas.width = fullSize;
                playerCanvas.height = fullSize;
            }

            const viewLeft = Math.max(0, Math.floor(wrapper.scrollLeft / state.tileSize));
            const viewTop = Math.max(0, Math.floor(wrapper.scrollTop / state.tileSize));
            const viewRight = Math.min(MAP_SIZE, Math.ceil((wrapper.scrollLeft + wrapper.clientWidth) / state.tileSize));
            const viewBottom = Math.min(MAP_SIZE, Math.ceil((wrapper.scrollTop + wrapper.clientHeight) / state.tileSize));

            if (!baseMapCache.canvas || baseMapCache.tileSize !== state.tileSize) {
                rebuildBaseMapCache();
            }

            const hatch = getHatchPattern(ctx);
            const borderPaths = new Map();

            // Draw cached base terrain (only visible area)
            const sx = viewLeft * state.tileSize;
            const sy = viewTop * state.tileSize;
            const sw = (viewRight - viewLeft) * state.tileSize;
            const sh = (viewBottom - viewTop) * state.tileSize;
            if (baseMapCache.canvas && sw > 0 && sh > 0) {
                ctx.drawImage(baseMapCache.canvas, sx, sy, sw, sh, sx, sy, sw, sh);
            }

            for (let y = viewTop; y < viewBottom; y++) {
                for (let x = viewLeft; x < viewRight; x++) {
                    const t = state.worldMap[y][x];
                    const px = x * state.tileSize;
                    const py = y * state.tileSize;
                    const ts = state.tileSize;

                    // 1. 영향권/마나 레이어
                    if (state.mapLayers.influence && t.influencedBy) {
                        const infSettlement = state.settlements.find(s => s.id === t.influencedBy);
                        if (infSettlement) {
                            const st = state.worldMap[infSettlement.tiles[0].y][infSettlement.tiles[0].x];
                            ctx.fillStyle = st.nationId ? state.history.nations.find(na => na.id === st.nationId)?.color.replace('0.45', '0.25') : 'rgba(99, 102, 241, 0.3)';
                            ctx.fillRect(px, py, ts, ts);
                        }
                    }
                    if (state.mapLayers.mana && t.mana > 0.05) {
                        // 💡 투명도 버그 수정
                        ctx.globalAlpha = Math.min(1.0, t.mana * 0.5);
                        ctx.fillStyle = '#a855f7';
                        ctx.fillRect(px, py, ts, ts);
                        ctx.globalAlpha = 1.0;
                    }

                    // 2. 국경선 로직
                    if (state.mapLayers.borders && t.nationId) {
                        const n = state.history.nations.find(na => na.id === t.nationId);
                        if (n) {
                            // 기본 채우기 및 빗금
                            ctx.globalAlpha = 0.3;
                            ctx.fillStyle = n.color;
                            ctx.fillRect(px, py, ts, ts);
                            ctx.globalAlpha = 1.0;
                            ctx.fillStyle = hatch;
                            ctx.fillRect(px, py, ts, ts);

                            if (!borderPaths.has(t.nationId)) borderPaths.set(t.nationId, new Path2D());
                            const path = borderPaths.get(t.nationId);

                            const off = Math.max(1, ts * 0.15); // 안쪽 여백
                            const n_id = t.nationId;

                            const getID = (dx, dy) => {
                                let nx = x + dx,
                                    ny = y + dy;
                                if (nx < 0 || nx >= MAP_SIZE || ny < 0 || ny >= MAP_SIZE) return null;
                                return state.worldMap[ny][nx].nationId;
                            };

                            const N = getID(0, -1),
                                S = getID(0, 1),
                                W = getID(-1, 0),
                                E = getID(1, 0);

                            // 💡 핵심: 4개의 선분을 안쪽으로 밀어서 그리되, 
                            // 인접한 면이 같은 국가라면 선을 연장하여 모서리를 메꿈

                            // 상단 선 (North Border)
                            if (N !== n_id) {
                                let x1 = (W === n_id) ? px : px + off;
                                let x2 = (E === n_id) ? px + ts : px + ts - off;
                                path.moveTo(x1, py + off);
                                path.lineTo(x2, py + off);
                            }
                            // 하단 선 (South Border)
                            if (S !== n_id) {
                                let x1 = (W === n_id) ? px : px + off;
                                let x2 = (E === n_id) ? px + ts : px + ts - off;
                                path.moveTo(x1, py + ts - off);
                                path.lineTo(x2, py + ts - off);
                            }
                            // 좌측 선 (West Border)
                            if (W !== n_id) {
                                let y1 = (N === n_id) ? py : py + off;
                                let y2 = (S === n_id) ? py + ts : py + ts - off;
                                path.moveTo(px + off, y1);
                                path.lineTo(px + off, y2);
                            }
                            // 우측 선 (East Border)
                            if (E !== n_id) {
                                let y1 = (N === n_id) ? py : py + off;
                                let y2 = (S === n_id) ? py + ts : py + ts - off;
                                path.moveTo(px + ts - off, y1);
                                path.lineTo(px + ts - off, y2);
                            }

                            // 💡 바깥쪽으로 꺾이는 모서리 (L자 연결부) 채우기
                            // 대각선 타일만 내 땅이 아닐 때, 기역(ㄱ)자로 꺾이는 선을 자연스럽게 연결
                            if (N === n_id && W === n_id && getID(-1, -1) !== n_id) {
                                path.moveTo(px, py + off);
                                path.lineTo(px + off, py + off);
                                path.lineTo(px + off, py);
                            }
                            if (N === n_id && E === n_id && getID(1, -1) !== n_id) {
                                path.moveTo(px + ts, py + off);
                                path.lineTo(px + ts - off, py + off);
                                path.lineTo(px + ts - off, py);
                            }
                            if (S === n_id && W === n_id && getID(-1, 1) !== n_id) {
                                path.moveTo(px, py + ts - off);
                                path.lineTo(px + off, py + ts - off);
                                path.lineTo(px + off, py + ts);
                            }
                            if (S === n_id && E === n_id && getID(1, 1) !== n_id) {
                                path.moveTo(px + ts, py + ts - off);
                                path.lineTo(px + ts - off, py + ts - off);
                                path.lineTo(px + ts - off, py + ts);
                            }
                        }
                    }
                }
            }

            // 국경선 최종 출력
            if (state.mapLayers.borders) {
                ctx.save();
                ctx.lineWidth = Math.max(1, state.tileSize * 0.08);
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                borderPaths.forEach((path, nationId) => {
                    const n = state.history.nations.find(na => na.id === nationId);
                    if (n) {
                        ctx.strokeStyle = n.color.replace('0.45', '1.0');
                        ctx.stroke(path);
                    }
                });
                ctx.restore();
            }

            // 격자선 및 하단 기능 유지
            if (state.tileSize > 15) {
                ctx.strokeStyle = 'rgba(0,0,0,0.08)';
                ctx.beginPath();
                for (let x = viewLeft; x <= viewRight; x++) {
                    ctx.moveTo(x * state.tileSize, viewTop * state.tileSize);
                    ctx.lineTo(x * state.tileSize, viewBottom * state.tileSize);
                }
                for (let y = viewTop; y <= viewBottom; y++) {
                    ctx.moveTo(viewLeft * state.tileSize, y * state.tileSize);
                    ctx.lineTo(viewRight * state.tileSize, y * state.tileSize);
                }
                ctx.stroke();
            }
            drawPlayerOverlay();
            // ... (나머지 이벤트 리스너 로직 동일)
            if (wrapper && !wrapper.dataset.hasWheelEvent) {
                wrapper.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const rect = wrapper.getBoundingClientRect();
                    zoomMap(e.deltaY > 0 ? -2 : 2, e.clientX - rect.left, e.clientY - rect.top);
                }, {
                    passive: false
                });
                wrapper.dataset.hasWheelEvent = "true";
            }
            if (wrapper && !wrapper.dataset.hasScrollEvent) {
                wrapper.addEventListener('scroll', () => {
                    if (state.inGameTab === 'map' && !state.isAnimating) {
                        requestAnimationFrame(drawPlayerOverlay);
                        requestAnimationFrame(() => requestMapRender(false));
                        scheduleMiniMapUpdate();
                    }
                });
                wrapper.dataset.hasScrollEvent = "true";
            }
            if (wrapper && !wrapper.dataset.hasDragEvents) {
                let startX, startY, scrollLeft, scrollTop;
                let isMapPointerDown = false; // 💡 외부 클릭 분리

                wrapper.onmousedown = (e) => {
                    isDraggingMap = false;
                    isMapPointerDown = true;
                    startX = e.pageX - wrapper.offsetLeft;
                    startY = e.pageY - wrapper.offsetTop;
                    scrollLeft = wrapper.scrollLeft;
                    scrollTop = wrapper.scrollTop;
                    wrapper.style.cursor = 'grabbing';
                };
                wrapper.onmouseleave = () => {
                    isMapPointerDown = false;
                    wrapper.style.cursor = 'grab';
                };
                wrapper.onmouseup = () => {
                    isMapPointerDown = false;
                    wrapper.style.cursor = 'grab';
                    setTimeout(() => {
                        isDraggingMap = false;
                    }, 50);
                };
                wrapper.onmousemove = (e) => {
                    // 💡 드래그가 맵 바깥(툴바 등)에서 시작되었다면 맵 이동을 무시
                    if (e.buttons !== 1 || !isMapPointerDown) return;
                    e.preventDefault();
                    const x = e.pageX - wrapper.offsetLeft;
                    const y = e.pageY - wrapper.offsetTop;
                    const walkX = (x - startX) * 1.5;
                    const walkY = (y - startY) * 1.5;
                    if (Math.abs(walkX) > 5 || Math.abs(walkY) > 5) isDraggingMap = true;
                    wrapper.scrollLeft = scrollLeft - walkX;
                    wrapper.scrollTop = scrollTop - walkY;
                };
                wrapper.onclick = (e) => {
                    if (isDraggingMap) return;
                    // ... (이하 기존 onclick 로직 그대로 유지)
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const x = (e.clientX - rect.left) * scaleX;
                    const y = (e.clientY - rect.top) * scaleY;
                    const tx = Math.floor(x / state.tileSize);
                    const ty = Math.floor(y / state.tileSize);
                    if (tx >= 0 && tx < MAP_SIZE && ty >= 0 && ty < MAP_SIZE) {
                        showTileModal(tx, ty);
                    }
                };
                wrapper.dataset.hasDragEvents = "true";
            }
            if (resetCenter) centerMapOnPlayer();
        }
        // 💡 렉 감소의 핵심 로직: 화면에 보이는 부분(Viewport)만 검사해서 그림
        function drawPlayerOverlay() {
            const pCanvas = document.getElementById('player-canvas');
            const wrapper = document.getElementById('map-wrapper');
            if (!pCanvas || !wrapper || !state.player || !state.player.location) return;
            const pCtx = pCanvas.getContext('2d');

            pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

            // Viewport 영역 계산 (화면 밖의 타일은 아예 검사하지 않음)
            const startX = Math.max(0, Math.floor(wrapper.scrollLeft / state.tileSize) - 2);
            const startY = Math.max(0, Math.floor(wrapper.scrollTop / state.tileSize) - 2);
            const endX = Math.min(MAP_SIZE, Math.ceil((wrapper.scrollLeft + wrapper.clientWidth) / state.tileSize) + 2);
            const endY = Math.min(MAP_SIZE, Math.ceil((wrapper.scrollTop + wrapper.clientHeight) / state.tileSize) + 2);

            const roadChars = ['▪', '╹', '╺', '└', '╻', '│', '┌', '├', '╸', '┘', '─', '┴', '┐', '┤', '┬', '┼'];

            pCtx.textAlign = "center";
            pCtx.textBaseline = "middle";

            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    let t = state.worldMap[y][x];
                    let px = x * state.tileSize;
                    let py = y * state.tileSize;

                    if (t.hasRoad) {
                        let mask = 0;
                        if (t.y > 0 && state.worldMap[t.y - 1][t.x].hasRoad) mask |= 1;
                        if (t.x < MAP_SIZE - 1 && state.worldMap[t.y][t.x + 1].hasRoad) mask |= 2;
                        if (t.y < MAP_SIZE - 1 && state.worldMap[t.y + 1][t.x].hasRoad) mask |= 4;
                        if (t.x > 0 && state.worldMap[t.y][t.x - 1].hasRoad) mask |= 8;
                        let cx = px + state.tileSize / 2;
                        let cy = py + state.tileSize / 2;
                        pCtx.fillStyle = 'rgba(180, 83, 9, 0.9)';
                        pCtx.font = `bold ${state.tileSize * 1.3}px monospace`;
                        pCtx.fillText(roadChars[mask], cx, cy + (state.tileSize * 0.05));
                    }

                }
            }

            state.settlements.forEach(s => {
                if (s.tiles.length > 0) {
                    const ct = s.tiles[0];
                    if (ct.x >= startX && ct.x <= endX && ct.y >= startY && ct.y <= endY) {
                        const px = ct.x * state.tileSize + (state.tileSize / 2);
                        const py = ct.y * state.tileSize + (state.tileSize / 2);
                        if (state.tileSize > 10) {
                            pCtx.font = `${state.tileSize * 1.2}px Arial`;
                            pCtx.fillText(SETTLEMENT_TIERS[s.type].icon, px, py);
                        } else {
                            pCtx.fillStyle = '#f59e0b';
                            pCtx.beginPath();
                            pCtx.arc(px, py, state.tileSize / 2, 0, Math.PI * 2);
                            pCtx.fill();
                        }
                    }
                }
            });

            if (state.hostileBands && state.hostileBands.length > 0) {
                const showDebugBands = isHostileBandDebugModeOn();
                if (showDebugBands) {
                    state.hostileBands.forEach(b => {
                        if (b.x < startX || b.x > endX || b.y < startY || b.y > endY) return;
                        const px = b.x * state.tileSize + (state.tileSize / 2);
                        const py = b.y * state.tileSize + (state.tileSize / 2);
                        if (state.tileSize > 10) {
                            pCtx.font = `${Math.max(11, state.tileSize * 1.0)}px Arial`;
                            pCtx.fillText(b.icon || '⚠️', px, py);
                        } else {
                            pCtx.fillStyle = '#dc2626';
                            pCtx.beginPath();
                            pCtx.arc(px, py, Math.max(2, state.tileSize / 3), 0, Math.PI * 2);
                            pCtx.fill();
                        }
                    });
                }
            }

            if (state.screen === 'world' || state.screen === 'history') {
                let pathAction = state.player.actionQueue ? state.player.actionQueue.find(a => a.type === 'travel') : null;
                if (pathAction && pathAction.path && pathAction.path.length > 0 && !state.isAnimating) {
                    pCtx.beginPath();
                    const startLoc = state.animatingLocation || state.player.location;
                    const startPx = startLoc.x * state.tileSize + (state.tileSize / 2);
                    const startPy = startLoc.y * state.tileSize + (state.tileSize / 2);
                    pCtx.moveTo(startPx, startPy);
                    pathAction.path.forEach(p => {
                        pCtx.lineTo(p.x * state.tileSize + (state.tileSize / 2), p.y * state.tileSize + (state.tileSize / 2));
                    });
                    pCtx.strokeStyle = 'rgba(250, 204, 21, 0.8)';
                    pCtx.lineWidth = 3;
                    pCtx.setLineDash([8, 6]);
                    pCtx.stroke();
                    pCtx.setLineDash([]);
                    const dest = pathAction.path[pathAction.path.length - 1];
                    if (dest) {
                        const dPx = dest.x * state.tileSize + (state.tileSize / 2);
                        const dPy = dest.y * state.tileSize + (state.tileSize / 2);
                        pCtx.fillStyle = 'rgba(250, 204, 21, 0.9)';
                        pCtx.beginPath();
                        pCtx.arc(dPx, dPy, state.tileSize / 2.5, 0, Math.PI * 2);
                        pCtx.fill();
                        pCtx.strokeStyle = '#000';
                        pCtx.lineWidth = 1;
                        pCtx.stroke();
                    }
                }

                const drawLoc = state.animatingLocation || state.player.location;
                const px = drawLoc.x * state.tileSize + (state.tileSize / 2);
                const py = drawLoc.y * state.tileSize + (state.tileSize / 2);
                pCtx.fillStyle = 'rgba(0,0,0,0.5)';
                pCtx.beginPath();
                pCtx.arc(px + 2, py + 2, state.tileSize / 2, 0, Math.PI * 2);
                pCtx.fill();
                pCtx.fillStyle = '#ef4444';
                pCtx.beginPath();
                pCtx.arc(px, py, state.tileSize / 2.2, 0, Math.PI * 2);
                pCtx.fill();
                pCtx.strokeStyle = 'white';
                pCtx.lineWidth = state.tileSize > 10 ? 2 : 1;
                pCtx.stroke();

                const currentTile = state.worldMap[state.player.location.y][state.player.location.x];
                const terrainInfo = document.getElementById('ui-terrain-info');
                if (terrainInfo) {
                    terrainInfo.innerHTML = `${currentTile.name} <span class="text-xs text-purple-400 ml-2 border border-purple-500/50 bg-purple-900/30 px-1 rounded">마나 ${Math.floor(currentTile.mana*100)}%</span> <span class="text-xs text-yellow-400 ml-1 border border-yellow-500/50 bg-yellow-900/30 px-1 rounded">빛 ${Math.floor(currentTile.light*100)}%</span>`;
                }
                scheduleMiniMapUpdate();
        }
        }

        function resizeMiniMapCanvas() {
            const body = getEl('minimap-body');
            const canvas = getEl('minimap-canvas');
            if (!body || !canvas) return null;
            const styles = window.getComputedStyle(body);
            const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
            const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
            const w = Math.max(0, body.clientWidth - padX);
            const h = Math.max(0, body.clientHeight - padY);
            if (canvas.width !== w) canvas.width = w;
            if (canvas.height !== h) canvas.height = h;
            return {
                canvas,
                size: Math.min(w, h)
            };
        }

        function rebuildMinimapCache(size) {
            if (!minimapCache.canvas) minimapCache.canvas = document.createElement('canvas');
            if (minimapCache.canvas.width !== size || minimapCache.canvas.height !== size) {
                minimapCache.canvas.width = size;
                minimapCache.canvas.height = size;
            }
            minimapCache.size = size;
            const mctx = minimapCache.canvas.getContext('2d', { alpha: false });
            const tileW = size / MAP_SIZE;
            const tileH = size / MAP_SIZE;
            for (let y = 0; y < MAP_SIZE; y++) {
                for (let x = 0; x < MAP_SIZE; x++) {
                    const t = state.worldMap[y][x];
                    mctx.fillStyle = t.color || '#0f172a';
                    mctx.fillRect(x * tileW, y * tileH, Math.ceil(tileW), Math.ceil(tileH));
                }
            }
            minimapCache.dirty = false;
        }

        function drawMiniMap() {
            if (state.inGameTab !== 'map' || state.minimapCollapsed) return;
            const wrapper = getEl('map-wrapper');
            if (!wrapper || !state.worldMap) return;
            const resized = resizeMiniMapCanvas();
            if (!resized) return;
            const { canvas, size } = resized;
            if (size <= 0) return;

            if (minimapCache.dirty || minimapCache.size !== size || !minimapCache.canvas) {
                rebuildMinimapCache(size);
            }

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(minimapCache.canvas, 0, 0, size, size);

            // 현재 뷰포트 표시
            const viewLeft = wrapper.scrollLeft / (state.tileSize * MAP_SIZE);
            const viewTop = wrapper.scrollTop / (state.tileSize * MAP_SIZE);
            const viewW = wrapper.clientWidth / (state.tileSize * MAP_SIZE);
            const viewH = wrapper.clientHeight / (state.tileSize * MAP_SIZE);
            ctx.strokeStyle = 'rgba(226,232,240,0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(viewLeft * size, viewTop * size, viewW * size, viewH * size);

            // 플레이어 위치 표시
            if (state.player && state.player.location) {
                const tileW = size / MAP_SIZE;
                const tileH = size / MAP_SIZE;
                const px = (state.player.location.x + 0.5) * tileW;
                const py = (state.player.location.y + 0.5) * tileH;
                ctx.fillStyle = '#facc15';
                ctx.beginPath();
                ctx.arc(px, py, Math.max(2, tileW * 1.2), 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function showTileModal(tx, ty) {
            const tile = state.worldMap[ty][tx];
            const modal = document.getElementById('tile-info-modal');
            if (!modal) return;
            state.selectedTileInfo = {
                x: tx,
                y: ty
            };

            let nationName = '무소속';
            let nationColor = 'text-white';
            if (tile.nationId) {
                const n = state.history.nations.find(na => na.id === tile.nationId);
                if (n) {
                    nationName = n.name;
                    nationColor = `text-[${n.color}]`;
                }
            }

            let settlementInfo = '<span class="text-slate-500">없음</span>';
            if (tile.settlementId) {
                const s = state.settlements.find(sett => sett.id === tile.settlementId);
                if (s) settlementInfo = `<span class="text-amber-400 font-bold">${s.name}</span> <span class="text-[10px] text-amber-200">(${SETTLEMENT_TIERS[s.type].name} / ${s.population.toLocaleString()}명)</span>`;
            }

            let influenceInfo = '<span class="text-slate-500">없음</span>';
            if (tile.influencedBy) {
                const infS = state.settlements.find(sett => sett.id === tile.influencedBy);
                if (infS) influenceInfo = `<span class="text-indigo-400 font-bold">${infS.name}의 영지</span>`;
            }

            const showHostileBandInfo = isHostileBandDebugModeOn();
            const hostileBand = showHostileBandInfo ? (state.hostileBands || []).find(b => b.x === tx && b.y === ty) : null;
            if (hostileBand && showHostileBandInfo) {
                influenceInfo += `<br><span class="text-rose-300 font-bold">${hostileBand.icon} ${hostileBand.name} 출몰</span>`;
            }

            document.getElementById('modal-tile-name').innerText = tile.name;
            document.getElementById('modal-tile-coords').innerText = `X: ${tx}, Y: ${ty}`;
            document.getElementById('modal-tile-nation').innerText = nationName;
            document.getElementById('modal-tile-settlement').innerHTML = settlementInfo;
            document.getElementById('modal-tile-influence').innerHTML = influenceInfo;
            document.getElementById('modal-tile-mana').innerText = `${Math.floor(tile.mana * 100)}%`;

            const resContainer = document.getElementById('modal-tile-resource-container');
            if (tile.resourceId && !tile.settlementId) {
                const res = MAP_RESOURCES.find(r => r.id === tile.resourceId);
                if (res) {
                    resContainer.innerHTML = `<div class="bg-amber-900/40 border border-amber-600/50 p-2 rounded text-sm"><div class="font-bold text-amber-300 flex items-center mb-1"><span class="mr-1">${res.icon}</span> 발견됨: ${res.name}</div><div class="text-xs text-amber-100/70 leading-tight">${res.desc}</div></div>`;
                    resContainer.classList.remove('hidden');
                } else {
                    resContainer.classList.add('hidden');
                }
            } else {
                resContainer.classList.add('hidden');
            }

            const movePanel = document.getElementById('ui-move-panel');
            const btnMove = document.getElementById('btn-move-here');
            const costLabel = document.getElementById('ui-move-cost');

            if (state.player.location) {
                movePanel.classList.remove('hidden');
                movePanel.classList.add('flex');
                if (state.player.location.x === tx && state.player.location.y === ty) {
                    costLabel.innerText = "📍 현재 위치입니다";
                    costLabel.className = "text-sm font-bold text-green-400 text-center";
                    btnMove.setAttribute('disabled', 'true');
                    btnMove.innerText = "현재 위치";
                } else {
                    const result = calculatePathAStar(state.player.location.x, state.player.location.y, tx, ty, false);
                    if (!result) {
                        costLabel.innerText = "❌ 지형에 막혀 도달할 수 없습니다";
                        costLabel.className = "text-sm font-bold text-rose-400 text-center";
                        btnMove.setAttribute('disabled', 'true');
                        btnMove.innerText = "도달 불가";
                    } else {
                        costLabel.innerHTML = `총 이동 비용: <span class="text-blue-200 font-black text-lg ml-1">${result.cost} AP</span>`;
                        costLabel.className = "text-sm font-bold text-blue-400 text-center";
                        btnMove.removeAttribute('disabled');
                        btnMove.innerText = "이곳으로 이동 예약";
                        btnMove.dataset.targetX = tx;
                        btnMove.dataset.targetY = ty;
                    }
                }
            } else {
                movePanel.classList.add('hidden');
            }

            modal.classList.remove('-translate-x-full', 'opacity-0', 'pointer-events-none');
            modal.classList.add('translate-x-0', 'opacity-100', 'pointer-events-auto');
        }
