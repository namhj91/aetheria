        // ==========================================
        // 2. 유틸리티 및 기초 로직
        // ==========================================
        function hash(x, y, seed) {
            let h = seed + x * 374761393 + y * 668265263;
            h = (h ^ (h >> 13)) * 1274126177;
            return (h ^ (h >> 16)) / 4294967296;
        }

        function smooth(t) {
            return t * t * (3 - 2 * t);
        }

        function lerp(a, b, t) {
            return a + (b - a) * t;
        }

        function valueNoise(x, y, seed) {
            let ix = Math.floor(x);
            let iy = Math.floor(y);
            let fx = x - ix;
            let fy = y - iy;
            let sx = smooth(fx);
            let sy = smooth(fy);
            let n00 = hash(ix, iy, seed);
            let n10 = hash(ix + 1, iy, seed);
            let n01 = hash(ix, iy + 1, seed);
            let n11 = hash(ix + 1, iy + 1, seed);
            return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy);
        }

        function fbm(x, y, octaves, seed) {
            let v = 0;
            let amp = 0.5;
            let freq = 1;
            let maxV = 0;
            for (let i = 0; i < octaves; i++) {
                v += valueNoise(x * freq, y * freq, seed) * amp;
                maxV += amp;
                freq *= 2;
                amp *= 0.5;
            }
            return v / maxV;
        }

        function getCalendarInfo(dateObj) {
            const m = dateObj.month;
            let seasonName = "",
                seasonDesc = "";
            if (m >= 3 && m <= 5) {
                seasonName = "엘다나스의 절기(봄)";
                seasonDesc = "테마: 정령 / 생명, 개화, 신록";
            } else if (m >= 6 && m <= 8) {
                seasonName = "드라칸의 절기(여름)";
                seasonDesc = "테마: 드래곤 / 열기, 투쟁, 생명력";
            } else if (m >= 9 && m <= 11) {
                seasonName = "두르간의 절기(가을)";
                seasonDesc = "테마: 거인 / 수확, 대지, 제련";
            } else {
                seasonName = "아르케의 절기(겨울)";
                seasonDesc = "테마: 천사 / 심판, 지혜, 침묵";
            }

            const monthData = {
                1: {
                    n: "로고스",
                    d: "진리와 언령의 룬"
                },
                2: {
                    n: "엔트로",
                    d: "혼돈과 소멸의 룬"
                },
                3: {
                    n: "피오라",
                    d: "생명과 치유의 룬"
                },
                4: {
                    n: "실루아",
                    d: "정령과 환영의 룬"
                },
                5: {
                    n: "아스트라",
                    d: "별과 예지의 룬"
                },
                6: {
                    n: "이그니스",
                    d: "기원염과 파괴의 룬"
                },
                7: {
                    n: "볼바르",
                    d: "뇌우와 기상의 룬"
                },
                8: {
                    n: "테라크",
                    d: "용혈과 변이의 룬"
                },
                9: {
                    n: "가란",
                    d: "대지와 진동의 룬"
                },
                10: {
                    n: "오리할",
                    d: "연금과 결속의 룬"
                },
                11: {
                    n: "모리아",
                    d: "수호와 봉인의 룬"
                },
                12: {
                    n: "아르카",
                    d: "순수 마나와 비전의 룬"
                }
            };
            const weekData = {
                1: {
                    n: "태동(胎動)",
                    d: "마력이 막 깨어나는 주"
                },
                2: {
                    n: "충만(充滿)",
                    d: "마력이 가득 차오르는 주"
                },
                3: {
                    n: "쇠퇴(衰退)",
                    d: "마력이 서서히 기우는 주"
                },
                4: {
                    n: "심연(深淵)",
                    d: "마력이 가라앉아 휴식하는 주"
                }
            };
            const w = dateObj.week || 1;
            return {
                seasonName,
                seasonDesc,
                monthName: monthData[m].n,
                monthDesc: monthData[m].d,
                weekName: weekData[w].n,
                weekDesc: weekData[w].d
            };
        }

        function centerMapOnPlayer() {
            setTimeout(() => {
                const wrapper = document.getElementById('map-wrapper');
                if (wrapper) {
                    if (state.player && state.player.location) {
                        const px = state.player.location.x * state.tileSize + (state.tileSize / 2);
                        const py = state.player.location.y * state.tileSize + (state.tileSize / 2);
                        wrapper.scrollLeft = px - (wrapper.clientWidth / 2);
                        wrapper.scrollTop = py - (wrapper.clientHeight / 2);
                        // 💡 포커싱 이후에 보이는 화면의 자원/텍스트 즉시 다시 그리기
                        requestAnimationFrame(drawPlayerOverlay);
                        scheduleMiniMapUpdate();
                    } else {
                        const px = (MAP_SIZE * state.tileSize) / 2;
                        const py = (MAP_SIZE * state.tileSize) / 2;
                        wrapper.scrollLeft = px - (wrapper.clientWidth / 2);
                        wrapper.scrollTop = py - (wrapper.clientHeight / 2);
                        requestAnimationFrame(drawPlayerOverlay);
                        scheduleMiniMapUpdate();
                    }
                }
            }, 10);
        }

        let mapRenderPending = false;
        function requestMapRender(resetCenter = false) {
            if (mapRenderPending) return;
            mapRenderPending = true;
            requestAnimationFrame(() => {
                mapRenderPending = false;
                drawCanvasMap(resetCenter);
            });
        }

        function zoomMap(delta, mouseX = null, mouseY = null) {
            const wrapper = document.getElementById('map-wrapper');
            if (!wrapper) return;
            // Prevent zooming out far enough to show empty space.
            const minTileSize = Math.max(1, Math.ceil(Math.max(wrapper.clientWidth, wrapper.clientHeight) / MAP_SIZE));
            let newTileSize = Math.max(minTileSize, Math.min(40, state.tileSize + delta));
            if (newTileSize === state.tileSize) return;
            if (mouseX === null) mouseX = wrapper.clientWidth / 2;
            if (mouseY === null) mouseY = wrapper.clientHeight / 2;
            const tileX = (wrapper.scrollLeft + mouseX) / state.tileSize;
            const tileY = (wrapper.scrollTop + mouseY) / state.tileSize;
            state.tileSize = newTileSize;
            requestMapRender(false);
            wrapper.scrollLeft = (tileX * state.tileSize) - mouseX;
            wrapper.scrollTop = (tileY * state.tileSize) - mouseY;
            scheduleMiniMapUpdate();
        }

        function zoomCityMap(delta, mouseX = null, mouseY = null) {
            const wrapper = document.getElementById('city-map-wrapper');
            if (!wrapper) return;
            // 수동 확대/축소 시 자동 맞춤 해제
            state.cityMapAutoFit = false;
            let newTileSize = Math.max(4, Math.min(60, state.cityTileSize + delta));
            if (newTileSize === state.cityTileSize) return;
            if (mouseX === null) mouseX = wrapper.clientWidth / 2;
            if (mouseY === null) mouseY = wrapper.clientHeight / 2;
            const tileX = (wrapper.scrollLeft + mouseX) / state.cityTileSize;
            const tileY = (wrapper.scrollTop + mouseY) / state.cityTileSize;
            state.cityTileSize = newTileSize;
            drawCityMap(false);
            wrapper.scrollLeft = (tileX * state.cityTileSize) - mouseX;
            wrapper.scrollTop = (tileY * state.cityTileSize) - mouseY;
        }

        // 도시 지도를 현재 패널 크기에 맞춰 한 화면에 들어오게 조정
        function fitCityMapToView() {
            const wrapper = document.getElementById('city-map-wrapper');
            if (!wrapper || !state.player || !state.player.location) return;
            const currentTile = state.worldMap[state.player.location.y][state.player.location.x];
            const s = state.settlements.find(sett => sett.id === currentTile.settlementId);
            if (!s || !s.layoutData) return;
            const gw = s.layoutData.gw;
            const gh = s.layoutData.gh;
            if (!gw || !gh) return;

            const padding = 16; // 패널 여백
            const maxW = Math.max(80, wrapper.clientWidth - padding);
            const maxH = Math.max(80, wrapper.clientHeight - padding);
            const fitSize = Math.floor(Math.min(maxW / gw, maxH / gh));
            const clamped = Math.max(2, Math.min(40, fitSize));
            if (Number.isFinite(clamped) && clamped !== state.cityTileSize) {
                state.cityTileSize = clamped;
            }
            // 전체보기 모드에서는 스크롤을 맨 앞으로
            wrapper.scrollLeft = 0;
            wrapper.scrollTop = 0;
        }

        function addTurnLog(msg) {
            if (!state.turnLogs) state.turnLogs = [];
            if (state.turnLogs.length === 0) {
                state.turnLogs.unshift({
                    title: `${state.gameDate.year}년 ${state.gameDate.month}월 ${state.gameDate.week}주차`,
                    logs: []
                });
            }
            state.turnLogs[0].logs.push(msg);
        }
