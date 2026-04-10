// ============================================
// CONFIGURAÇÃO DA API
// ============================================

const API_URL = 'https://ppl-anac-backend.onrender.com';

// ============================================
// ESTADO GLOBAL
// ============================================

let usuarioAtual      = null;
let token             = null;
let questoesSimulado  = [];
let questaoAtualIndex = 0;
let respostasSimulado = {};
let timerSimulado     = null;
let segundosSimulado  = 0;
let flashcardsLista   = [];
let flashcardAtualIndex = 0;
let flashcardVirado   = false;
let servidorAcordado  = false;

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    token = localStorage.getItem('token');
    const usuarioSalvo = localStorage.getItem('usuario');

    const btnPular = document.getElementById('btnPularLoading');
    const timerBtnPular = setTimeout(() => {
        if (btnPular) btnPular.style.display = 'inline-block';
    }, 8000);

    if (token && usuarioSalvo) {
        try { usuarioAtual = JSON.parse(usuarioSalvo); } catch { usuarioAtual = null; }

        if (usuarioAtual) {
            // ✅ Entra direto com dados do cache — sem esperar servidor
            clearTimeout(timerBtnPular);
            mostrarTela('main');
            atualizarNavbar();
            renderizarDadosDashboard(usuarioAtual);
            document.getElementById('dashboardUserName').textContent = usuarioAtual.nome;

            // Atualiza em background sem bloquear a UI
            carregarMaterias();
            carregarDashboard();
        } else {
            clearTimeout(timerBtnPular);
            mostrarTela('auth');
        }
    } else {
        clearTimeout(timerBtnPular);
        mostrarTela('auth');
    }
});

// ============================================
// BOTÃO DE ESCAPE DO LOADING
// ============================================

function pularLoading() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    token        = null;
    usuarioAtual = null;
    mostrarTela('auth');
}

// ============================================
// HELPER: mensagem de loading
// ============================================

function atualizarMensagemLoading(msg) {
    const el = document.getElementById('loadingMsg');
    if (el) el.textContent = msg;
}

// ============================================
// HELPER: fetch autenticado
// ============================================

function fetchComToken(path, options = {}) {
    return fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {})
        }
    });
}

// ============================================
// HELPER: controle de telas
// ============================================

function mostrarTela(qual) {
    const loading = document.getElementById('loading');
    const app     = document.getElementById('app');
    const auth    = document.getElementById('authScreen');
    const main    = document.getElementById('mainScreen');
    const navbar  = document.getElementById('navbar');

    loading.style.display = 'none';
    app.style.display     = 'block';

    if (qual === 'auth') {
        auth.style.display   = 'flex';
        main.style.display   = 'none';
        navbar.style.display = 'none';
    } else {
        auth.style.display   = 'none';
        main.style.display   = 'block';
        navbar.style.display = 'flex';
    }
}

// ============================================
// AUTENTICAÇÃO
// ============================================

async function fazerLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value.trim();

    if (!email || !senha) {
        mostrarToast('⚠️ Preencha todos os campos!', 'warning');
        return;
    }

    const btn = document.querySelector('#loginForm .btn-primary');
    btn.disabled    = true;
    btn.textContent = '⏳ Entrando...';

    try {
        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), 20000);

        const res = await fetch(`${API_URL}/api/usuarios/login`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, senha }),
            signal:  controller.signal
        });

        clearTimeout(timeout);

        const data = await res.json();

        if (!res.ok) {
            mostrarToast(data.erro || '❌ Email ou senha incorretos', 'error');
            return;
        }

        token        = data.token;
        usuarioAtual = data.usuario;
        localStorage.setItem('token', token);
        localStorage.setItem('usuario', JSON.stringify(usuarioAtual));

        mostrarToast(`✈️ Bem-vindo, ${usuarioAtual.nome}!`, 'success');
        mostrarTela('main');
        atualizarNavbar();
        await carregarDashboard();
        await carregarMaterias();

    } catch (err) {
        const msg = err.name === 'AbortError'
            ? '⏳ Servidor demorando. Tente novamente em 30s.'
            : '❌ Erro de conexão. Verifique sua internet.';
        mostrarToast(msg, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Entrar';
    }
}

async function fazerRegistro() {
    const nome  = document.getElementById('registerNome').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const senha = document.getElementById('registerSenha').value.trim();

    if (!nome || !email || !senha) {
        mostrarToast('⚠️ Preencha todos os campos!', 'warning');
        return;
    }
    if (senha.length < 6) {
        mostrarToast('⚠️ A senha deve ter pelo menos 6 caracteres!', 'warning');
        return;
    }

    const btn = document.querySelector('#registerForm .btn-primary');
    btn.disabled    = true;
    btn.textContent = '⏳ Criando conta...';

    try {
        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), 20000);

        const res = await fetch(`${API_URL}/api/usuarios/registro`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ nome, email, senha }),
            signal:  controller.signal
        });

        clearTimeout(timeout);
        const data = await res.json();

        if (!res.ok) {
            mostrarToast(data.erro || '❌ Erro ao criar conta', 'error');
            return;
        }

        token        = data.token;
        usuarioAtual = data.usuario;
        localStorage.setItem('token', token);
        localStorage.setItem('usuario', JSON.stringify(usuarioAtual));

        mostrarToast('✅ Conta criada com sucesso!', 'success');
        mostrarTela('main');
        atualizarNavbar();
        await carregarDashboard();
        await carregarMaterias();

    } catch (err) {
        const msg = err.name === 'AbortError'
            ? '⏳ Servidor demorando. Tente novamente em 30s.'
            : '❌ Erro de conexão com o servidor.';
        mostrarToast(msg, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Criar Conta';
    }
}

function logout() {
    clearInterval(timerSimulado);
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    token             = null;
    usuarioAtual      = null;
    questoesSimulado  = [];
    respostasSimulado = {};
    flashcardsLista   = [];
    mostrarLogin();
    mostrarTela('auth');
    mostrarToast('✈️ Até logo!', 'success');
}

function mostrarRegistro() {
    document.getElementById('loginForm').style.display    = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

function mostrarLogin() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display    = 'block';
}

// ============================================
// NAVEGAÇÃO
// ============================================

function navegarPara(view) {
    const views = ['dashboard', 'simulado', 'flashcards', 'ranking', 'conquistas'];
    views.forEach(v => {
        document.getElementById(`${v}View`).style.display = 'none';
    });

    document.getElementById(`${view}View`).style.display = 'block';

    if (view === 'ranking')    carregarRanking();
    if (view === 'conquistas') carregarConquistas();
    if (view === 'flashcards') carregarFlashcards();
    if (view === 'simulado') {
        document.getElementById('simuladoConfig').style.display    = 'block';
        document.getElementById('simuladoArea').style.display      = 'none';
        document.getElementById('simuladoResultado').style.display = 'none';
    }
}

// ============================================
// NAVBAR E DASHBOARD
// ============================================

function atualizarNavbar() {
    if (!usuarioAtual) return;
    document.getElementById('userName').textContent  = usuarioAtual.nome;
    document.getElementById('userXP').textContent    = `${usuarioAtual.xp || 0} XP`;
    document.getElementById('userLevel').textContent = `Nível ${usuarioAtual.nivel || 1}`;
}

function renderizarDadosDashboard(usuario) {
    const xp        = usuario.xp    || 0;
    const nivel     = usuario.nivel || 1;
    const xpProximo = nivel * 500;
    const pct       = Math.min(((xp % 500) / 500) * 100, 100);
    const total     = usuario.questoesRespondidas || 0;
    const acertos   = usuario.questoesCorretas    || 0;
    const taxa      = total > 0 ? Math.round((acertos / total) * 100) : 0;

    document.getElementById('statQuestoes').textContent   = total;
    document.getElementById('statAcertos').textContent    = `${taxa}%`;
    document.getElementById('statSimulados').textContent  = usuario.simuladosRealizados || 0;
    document.getElementById('statSequencia').textContent  = usuario.sequenciaDias       || 0;
    document.getElementById('nivelAtual').textContent     = nivel;
    document.getElementById('xpAtual').textContent        = xp;
    document.getElementById('xpProximo').textContent      = xpProximo;
    document.getElementById('xpProgressFill').style.width = `${pct}%`;
    document.getElementById('userXP').textContent         = `${xp} XP`;
    document.getElementById('userLevel').textContent      = `Nível ${nivel}`;
}

async function carregarDashboard() {
    if (!usuarioAtual) return;
    document.getElementById('dashboardUserName').textContent = usuarioAtual.nome;

    // Renderiza imediatamente com dados em cache
    renderizarDadosDashboard(usuarioAtual);

    // Atualiza em background
    try {
        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
        });

        clearTimeout(timeout);
        if (!res.ok) return;

        usuarioAtual = await res.json();
        localStorage.setItem('usuario', JSON.stringify(usuarioAtual));
        renderizarDadosDashboard(usuarioAtual);
        atualizarNavbar();

    } catch {
        console.warn('Dashboard: usando dados em cache.');
    }
}

// ============================================
// MATÉRIAS
// ============================================

async function carregarMaterias() {
    try {
        const res = await fetch(`${API_URL}/api/questoes/materias`);
        if (!res.ok) return;

        const data = await res.json();
        const sel  = document.getElementById('simuladoMateria');

        sel.innerHTML = '<option value="">Todas as Matérias</option>';
        (data.materias || []).forEach(m => {
            sel.innerHTML += `<option value="${m}">${m}</option>`;
        });
    } catch (err) {
        console.warn('Erro ao carregar matérias:', err);
    }
}

// ============================================
// SIMULADO
// ============================================

async function iniciarSimulado() {
    const materia = document.getElementById('simuladoMateria').value;
    const qtd     = parseInt(document.getElementById('simuladoQtd').value);

    const btn = document.querySelector('.simulado-config .btn-primary');
    btn.disabled    = true;
    btn.textContent = '⏳ Carregando questões...';

    try {
        let url = `/api/questoes/random?limite=${qtd}`;
        if (materia) url += `&materia=${encodeURIComponent(materia)}`;

        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), 15000);

        const res  = await fetchComToken(url, { signal: controller.signal });
        clearTimeout(timeout);

        const data = await res.json();

        if (!data.questoes || data.questoes.length === 0) {
            mostrarToast('⚠️ Nenhuma questão encontrada para essa matéria!', 'warning');
            return;
        }

        questoesSimulado  = data.questoes;
        questaoAtualIndex = 0;
        respostasSimulado = {};
        segundosSimulado  = 0;

        document.getElementById('questaoTotal').textContent        = questoesSimulado.length;
        document.getElementById('simuladoConfig').style.display    = 'none';
        document.getElementById('simuladoArea').style.display      = 'block';
        document.getElementById('simuladoResultado').style.display = 'none';

        iniciarTimer();
        renderizarQuestao();

    } catch (err) {
        const msg = err.name === 'AbortError'
            ? '⏳ Timeout ao carregar questões. Tente novamente.'
            : '❌ Erro ao carregar questões!';
        mostrarToast(msg, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Iniciar Simulado ✈️';
    }
}

function iniciarTimer() {
    clearInterval(timerSimulado);
    timerSimulado = setInterval(() => {
        segundosSimulado++;
        const m = String(Math.floor(segundosSimulado / 60)).padStart(2, '0');
        const s = String(segundosSimulado % 60).padStart(2, '0');
        document.getElementById('simuladoTempo').textContent = `${m}:${s}`;
    }, 1000);
}

function renderizarQuestao() {
    const q = questoesSimulado[questaoAtualIndex];
    if (!q) return;

    document.getElementById('questaoNumero').textContent = questaoAtualIndex + 1;

    const respondida          = respostasSimulado[questaoAtualIndex] !== undefined;
    const respostaSelecionada = respostasSimulado[questaoAtualIndex];

    let altHTML = '';
    (q.alternativas || []).forEach((alt, i) => {
        let cls = 'alternativa';
        if (respondida) {
            if (i === q.resposta_correta)       cls += ' correta';
            else if (i === respostaSelecionada) cls += ' incorreta';
        } else if (i === respostaSelecionada) {
            cls += ' selecionada';
        }

        const clicavel = respondida ? '' : `onclick="selecionarResposta(${i})"`;
        altHTML += `<div class="${cls}" ${clicavel}>${alt}</div>`;
    });

    document.getElementById('questaoContainer').innerHTML = `
        <div class="questao-materia">${q.materia || 'Geral'}</div>
        <div class="questao-pergunta">${q.pergunta}</div>
        <div class="alternativas">${altHTML}</div>
        ${respondida && q.explicacao
            ? `<div class="questao-explicacao">
                   <strong>💡 Explicação:</strong> ${q.explicacao}
               </div>`
            : ''}
    `;

    document.getElementById('btnAnterior').disabled = questaoAtualIndex === 0;
    const ultima = questaoAtualIndex === questoesSimulado.length - 1;
    document.getElementById('btnProxima').style.display   = ultima ? 'none'         : 'inline-block';
    document.getElementById('btnFinalizar').style.display = ultima ? 'inline-block' : 'none';
}

function selecionarResposta(indice) {
    if (respostasSimulado[questaoAtualIndex] !== undefined) return;
    respostasSimulado[questaoAtualIndex] = indice;
    renderizarQuestao();
}

function proximaQuestao() {
    if (questaoAtualIndex < questoesSimulado.length - 1) {
        questaoAtualIndex++;
        renderizarQuestao();
    }
}

function questaoAnterior() {
    if (questaoAtualIndex > 0) {
        questaoAtualIndex--;
        renderizarQuestao();
    }
}

async function finalizarSimulado() {
    clearInterval(timerSimulado);

    const respondidas = Object.keys(respostasSimulado).length;
    if (respondidas < questoesSimulado.length) {
        const faltam = questoesSimulado.length - respondidas;
        if (!confirm(`Você ainda tem ${faltam} questão(ões) sem resposta. Deseja finalizar mesmo assim?`)) {
            iniciarTimer();
            return;
        }
    }

    let acertos = 0;
    questoesSimulado.forEach((q, i) => {
        if (respostasSimulado[i] === q.resposta_correta) acertos++;
    });

    const total    = questoesSimulado.length;
    const pct      = Math.round((acertos / total) * 100);
    const aprovado = pct >= 70;

    try {
        await fetchComToken('/api/simulados/salvar', {
            method: 'POST',
            body: JSON.stringify({
                questoes: questoesSimulado.map((q, i) => ({
                    questaoId:       q._id,
                    respostaUsuario: respostasSimulado[i] ?? -1,
                    correta:         respostasSimulado[i] === q.resposta_correta
                })),
                acertos,
                total,
                tempo: segundosSimulado
            })
        });
    } catch (err) {
        console.warn('Erro ao salvar simulado:', err);
    }

    const m = String(Math.floor(segundosSimulado / 60)).padStart(2, '0');
    const s = String(segundosSimulado % 60).padStart(2, '0');

    document.getElementById('simuladoArea').style.display      = 'none';
    document.getElementById('simuladoResultado').style.display = 'block';
    document.getElementById('simuladoResultado').innerHTML = `
        <div class="resultado-container">
            <div class="resultado-icon">${aprovado ? '🏆' : '📚'}</div>
            <h2>${aprovado ? 'Parabéns! Você foi aprovado!' : 'Continue estudando!'}</h2>
            <div class="resultado-porcentagem ${aprovado ? 'aprovado' : 'reprovado'}">${pct}%</div>
            <div class="resultado-detalhes">
                <div class="resultado-item">
                    <div class="resultado-item-value" style="color:var(--success)">${acertos}</div>
                    <div class="resultado-item-label">Acertos</div>
                </div>
                <div class="resultado-item">
                    <div class="resultado-item-value" style="color:var(--danger)">${total - acertos}</div>
                    <div class="resultado-item-label">Erros</div>
                </div>
                <div class="resultado-item">
                    <div class="resultado-item-value">${total}</div>
                    <div class="resultado-item-label">Total</div>
                </div>
                <div class="resultado-item">
                    <div class="resultado-item-value">${m}:${s}</div>
                    <div class="resultado-item-label">Tempo</div>
                </div>
            </div>
            <div style="display:flex;gap:15px;justify-content:center;flex-wrap:wrap;margin-top:20px">
                <button onclick="navegarPara('simulado')" class="btn btn-primary">🔄 Novo Simulado</button>
                <button onclick="navegarPara('dashboard')" class="btn btn-secondary">🏠 Dashboard</button>
            </div>
        </div>
    `;

    mostrarToast(
        aprovado ? `🏆 Aprovado com ${pct}%!` : `📚 ${pct}% — Continue estudando!`,
        aprovado ? 'success' : 'warning'
    );

    await carregarDashboard();
}

// ============================================
// FLASHCARDS
// ============================================

async function carregarFlashcards() {
    const area = document.getElementById('flashcardArea');
    area.innerHTML = '<p style="color:white;text-align:center">⏳ Carregando flashcards...</p>';

    try {
        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), 15000);

        const res  = await fetchComToken('/api/flashcards/estudar', { signal: controller.signal });
        clearTimeout(timeout);

        const data = await res.json();

        flashcardsLista     = data.flashcards || [];
        flashcardAtualIndex = 0;
        flashcardVirado     = false;

        if (flashcardsLista.length === 0) {
            area.innerHTML = `
                <div style="background:white;padding:40px;border-radius:20px;text-align:center;box-shadow:var(--shadow-lg)">
                    <div style="font-size:4rem">✅</div>
                    <h2 style="margin:20px 0;color:var(--dark)">Nenhum flashcard disponível</h2>
                    <p style="color:var(--gray)">Volte mais tarde para novos flashcards!</p>
                </div>`;
            return;
        }

        renderizarFlashcard();

    } catch (err) {
        const msg = err.name === 'AbortError'
            ? '⏳ Timeout. Tente novamente.'
            : '❌ Erro ao carregar flashcards';
        area.innerHTML = `<p style="color:white;text-align:center">${msg}</p>`;
    }
}

function renderizarFlashcard() {
    const area = document.getElementById('flashcardArea');
    const fc   = flashcardsLista[flashcardAtualIndex];
    if (!fc) return;

    flashcardVirado = false;

    area.innerHTML = `
        <div class="flashcard-container">
            <p style="color:white;text-align:center;margin-bottom:20px;font-size:1.1rem">
                Card ${flashcardAtualIndex + 1} de ${flashcardsLista.length}
            </p>
            <div class="flashcard" id="flashcard" onclick="virarFlashcard()">
                <span class="flashcard-materia">${fc.materia || 'Geral'}</span>
                <div class="flashcard-content" id="flashcardContent">${fc.pergunta}</div>
                <p class="flashcard-hint" id="flashcardHint">Clique para ver a resposta</p>
            </div>
            <div class="flashcard-acoes" id="flashcardAcoes" style="display:none">
                <p style="color:white;font-weight:600">Como foi?</p>
                <div class="flashcard-acoes-botoes">
                    <button class="btn-dificuldade btn-dificil" onclick="avaliarFlashcard('dificil')">😰 Difícil</button>
                    <button class="btn-dificuldade btn-bom"     onclick="avaliarFlashcard('bom')">😊 Bom</button>
                    <button class="btn-dificuldade btn-facil"   onclick="avaliarFlashcard('facil')">😎 Fácil</button>
                </div>
            </div>
        </div>
    `;
}

function virarFlashcard() {
    if (flashcardVirado) return;
    const fc = flashcardsLista[flashcardAtualIndex];
    flashcardVirado = true;

    document.getElementById('flashcard').classList.add('flipped');
    document.getElementById('flashcardContent').textContent = fc.resposta;
    document.getElementById('flashcardHint').style.display  = 'none';
    document.getElementById('flashcardAcoes').style.display = 'flex';
}

async function avaliarFlashcard(dificuldade) {
    const fc = flashcardsLista[flashcardAtualIndex];

    try {
        await fetchComToken('/api/flashcards/avaliar', {
            method: 'POST',
            body: JSON.stringify({ flashcardId: fc._id, dificuldade })
        });
    } catch (err) {
        console.warn('Erro ao avaliar flashcard:', err);
    }

    flashcardAtualIndex++;

    if (flashcardAtualIndex >= flashcardsLista.length) {
        document.getElementById('flashcardArea').innerHTML = `
            <div style="background:white;padding:60px;border-radius:20px;text-align:center;box-shadow:var(--shadow-lg)">
                <div style="font-size:5rem">🎉</div>
                <h2 style="margin:20px 0;color:var(--dark)">Sessão concluída!</h2>
                <p style="color:var(--gray);margin-bottom:30px">
                    Você estudou ${flashcardsLista.length} flashcard(s) hoje. Continue assim!
                </p>
                <div style="display:flex;gap:15px;justify-content:center;flex-wrap:wrap">
                    <button onclick="carregarFlashcards()" class="btn btn-primary">🔄 Estudar de novo</button>
                    <button onclick="navegarPara('dashboard')" class="btn btn-secondary">🏠 Dashboard</button>
                </div>
            </div>
        `;
        mostrarToast('🎉 Sessão de flashcards concluída!', 'success');
        return;
    }

    renderizarFlashcard();
}

// ============================================
// RANKING
// ============================================

async function carregarRanking() {
    const area = document.getElementById('rankingArea');
    area.innerHTML = '<p style="color:white;text-align:center">⏳ Carregando ranking...</p>';

    try {
        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), 15000);

        const res  = await fetch(`${API_URL}/api/usuarios/ranking`, { signal: controller.signal });
        clearTimeout(timeout);

        const data  = await res.json();
        const lista = data.ranking || [];

        if (lista.length === 0) {
            area.innerHTML = `
                <div class="ranking-container">
                    <p style="text-align:center;color:var(--gray)">Nenhum usuário no ranking ainda.</p>
                </div>`;
            return;
        }

        const posEmojis  = ['🥇', '🥈', '🥉'];
        const topClasses = ['top1', 'top2', 'top3'];

        let html = '<div class="ranking-container">';
        lista.forEach((u, i) => {
            const cls   = topClasses[i] || '';
            const emoji = posEmojis[i]  || `#${i + 1}`;
            const eu    = usuarioAtual && u._id === usuarioAtual._id ? ' (Você)' : '';
            html += `
                <div class="ranking-item ${cls}">
                    <div class="ranking-posicao">${emoji}</div>
                    <div class="ranking-avatar">👤</div>
                    <div class="ranking-info">
                        <div class="ranking-nome">${u.nome}${eu}</div>
                        <div class="ranking-nivel">Nível ${u.nivel || 1}</div>
                    </div>
                    <div class="ranking-xp">${u.xp || 0} XP</div>
                </div>`;
        });
        html += '</div>';
        area.innerHTML = html;

    } catch (err) {
        const msg = err.name === 'AbortError'
            ? '⏳ Timeout. Tente novamente.'
            : '❌ Erro ao carregar ranking';
        area.innerHTML = `<p style="color:white;text-align:center">${msg}</p>`;
    }
}

// ============================================
// CONQUISTAS
// ============================================

async function carregarConquistas() {
    const area = document.getElementById('conquistasArea');
    area.innerHTML = '<p style="color:white;text-align:center">⏳ Carregando conquistas...</p>';

    try {
        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), 15000);

        const res  = await fetchComToken('/api/conquistas', { signal: controller.signal });
        clearTimeout(timeout);

        const data  = await res.json();
        const lista = data.conquistas || [];

        if (lista.length === 0) {
            area.innerHTML = `
                <div class="conquistas-container">
                    <p style="text-align:center;color:var(--gray)">Nenhuma conquista disponível ainda.</p>
                </div>`;
            return;
        }

        let html = '<div class="conquistas-container"><div class="conquistas-grid">';
        lista.forEach(c => {
            const desbloqueada = c.desbloqueada ? 'desbloqueada' : '';
            html += `
                <div class="conquista-card ${desbloqueada}">
                    <div class="conquista-icon">${c.icone || '🏆'}</div>
                    <div class="conquista-nome">${c.nome}</div>
                    <div class="conquista-descricao">${c.descricao}</div>
                    <span class="conquista-xp">+${c.xp || 0} XP</span>
                </div>`;
        });
        html += '</div></div>';
        area.innerHTML = html;

    } catch (err) {
        const msg = err.name === 'AbortError'
            ? '⏳ Timeout. Tente novamente.'
            : '❌ Erro ao carregar conquistas';
        area.innerHTML = `<p style="color:white;text-align:center">${msg}</p>`;
    }
}

// ============================================
// TOAST
// ============================================

function mostrarToast(msg, tipo = '') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className   = `toast ${tipo} show`;
    setTimeout(() => { toast.className = 'toast'; }, 3500);
}
// ============================================
// DEBUG VISUAL — remove depois de resolver
// ============================================

const debugDiv = document.createElement('div');
debugDiv.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 200px;
    overflow-y: auto;
    background: rgba(0,0,0,0.85);
    color: #00ff00;
    font-size: 11px;
    font-family: monospace;
    padding: 8px;
    z-index: 99999;
`;
document.body.appendChild(debugDiv);

function debugLog(msg, tipo = 'log') {
    const cores = { log: '#00ff00', warn: '#ffff00', error: '#ff4444' };
    const cor   = cores[tipo] || '#00ff00';
    const linha = document.createElement('div');
    linha.style.color = cor;
    linha.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    debugDiv.appendChild(linha);
    debugDiv.scrollTop = debugDiv.scrollHeight;
}

const _log   = console.log.bind(console);
const _warn  = console.warn.bind(console);
const _error = console.error.bind(console);

console.log   = (...a) => { _log(...a);   debugLog(a.join(' '), 'log');   };
console.warn  = (...a) => { _warn(...a);  debugLog(a.join(' '), 'warn');  };
console.error = (...a) => { _error(...a); debugLog(a.join(' '), 'error'); };

window.onerror = (msg, src, line) => {
    debugLog(`ERRO: ${msg} (linha ${line})`, 'error');
};
