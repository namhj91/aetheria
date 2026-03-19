        function requestFullscreenBestEffort() {
            if (document.fullscreenElement) return Promise.resolve();
            const el = document.documentElement;
            const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
            if (!req) return Promise.resolve();
            return req.call(el);
        }

        function initMobileAutoFullscreen() {
            if (!window.matchMedia('(pointer: coarse)').matches) return;

            const onFirstGesture = () => {
                requestFullscreenBestEffort().catch(() => {});
                window.removeEventListener('pointerdown', onFirstGesture);
                window.removeEventListener('touchstart', onFirstGesture);
            };

            window.addEventListener('pointerdown', onFirstGesture, {
                once: true
            });
            window.addEventListener('touchstart', onFirstGesture, {
                once: true
            });
        }

        // 초기화 실행
        initMobileAutoFullscreen();
        setTimeout(initFloatingDebug, 1000); // UI가 완전히 렌더링된 후 툴박스 부착
        
        window.setPlayerAction = function(actionType) {
    if (state.combatState) {
        state.combatState.playerAction = actionType;
        renderDungeonCombat();
    }
};

window.executePlayerMove = function(targetPos) {
    let cState = state.combatState;
    let currentActor = cState.queue[0];
    
    if(!currentActor.isAlly) return;

    // 위치 갱신
    currentActor.position = targetPos;
    cState.log = `<span class="text-emerald-400">[${currentActor.name}]</span>이(가) 진형을 이동하여 전열을 가다듬었습니다.`;
    
    endCombatTurn();
};

window.executePlayerAttack = function(targetId) {
    let cState = state.combatState;
    let currentActor = cState.queue[0];
    
    if(!currentActor.isAlly) return;

    let target = cState.enemies.find(e => e.id === targetId);
    if(!target || target.hp <= 0) return;

    // 스킬과 일반공격 분기 처리
    let dmg = 0;
    if (cState.playerAction === 'skill') {
        dmg = Math.floor(state.player.finalStats.str * 1.2) + Math.floor(Math.random() * 20); // 스킬 계수
        cState.log = `<span class="text-indigo-400">[${currentActor.name}]</span>의 강력한 스킬! <span class="text-rose-300">[${target.name}]</span>에게 ${dmg} 피해!`;
    } else {
        dmg = Math.floor(state.player.finalStats.str * 0.5) + Math.floor(Math.random() * 10); // 평타 계수
        cState.log = `<span class="text-blue-400">[${currentActor.name}]</span>의 일반 공격! <span class="text-rose-300">[${target.name}]</span>에게 ${dmg} 피해!`;
    }
    
    target.hp -= dmg;
    
    if(target.hp <= 0) {
        cState.log += ` 적 처치!`;
        cState.enemies = cState.enemies.filter(e => e.hp > 0);
        cState.queue = cState.queue.filter(e => e.hp > 0);
    }

    endCombatTurn();
};
    
