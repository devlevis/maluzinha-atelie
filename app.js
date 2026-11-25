const CHAVE = "maluzinha-dados";
const CATEGORIAS = ["Fitas", "Apliques", "Bico de pato e presilhas", "Bases de tiara", "Elásticos e faixinhas", "Embalagens", "Outros"];
const UNIDADES = { un: "un", m: "m", pct: "pct", rolo: "rolo" };
const nomesTela = { inicio: "Início", materiais: "Materiais", compras: "Compras", produtos: "Produtos", encomendas: "Encomendas", backup: "Backup" };

let dados = carregar();
let filtroStatus = "abertas";
let filtroCategoria = "Todos";
let editando = null;
let comprando = null;

function novoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function carregar() {
    try {
        const salvo = JSON.parse(localStorage.getItem(CHAVE));
        if (salvo && salvo.produtos) {
            salvo.materiais = salvo.materiais || [];
            salvo.encomendas = salvo.encomendas || [];
            return salvo;
        }
    } catch (e) {
    }
    return {
        materiais: [],
        produtos: PRODUTOS_INICIAIS.map(p => ({ id: novoId(), quantidade: 0, ...p })),
        encomendas: []
    };
}

function salvar() {
    try {
        localStorage.setItem(CHAVE, JSON.stringify(dados));
    } catch (e) {
        avisar("Não foi possível salvar neste navegador");
    }
}

function dinheiro(v) {
    return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function numero(v) {
    return Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function dataBR(iso) {
    if (!iso) return "sem data";
    const [a, m, d] = iso.split("-");
    return d + "/" + m + "/" + a;
}

function diasAte(iso) {
    if (!iso) return null;
    const [a, m, d] = iso.split("-").map(Number);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.round((new Date(a, m - 1, d) - hoje) / 86400000);
}

function texto(t) {
    const div = document.createElement("div");
    div.textContent = t == null ? "" : t;
    return div.innerHTML;
}

function avisar(msg) {
    const el = document.getElementById("aviso");
    el.textContent = msg;
    el.classList.add("visivel");
    clearTimeout(avisar.t);
    avisar.t = setTimeout(() => el.classList.remove("visivel"), 2200);
}

function porId(lista, id) {
    return dados[lista].find(x => x.id === id);
}

function emFalta(m) {
    return Number(m.quantidade) <= Number(m.minimo);
}

function materiaisEmFalta() {
    return dados.materiais
        .filter(emFalta)
        .sort((a, b) => a.quantidade / (a.minimo || 1) - b.quantidade / (b.minimo || 1));
}

function nomeMaterial(m) {
    return m.nome + (m.cor ? " – " + m.cor : "");
}

function cartaoMaterial(m) {
    const falta = emFalta(m);
    return '<article class="item' + (falta ? " baixo" : "") + '" data-tipo="material" data-id="' + m.id + '">' +
        '<div class="item-topo"><strong>' + texto(nomeMaterial(m)) + '</strong>' +
        (falta ? '<span class="status falta">Comprar</span>' : "") + '</div>' +
        '<div class="item-rodape"><span>' + texto(m.categoria) + (m.fornecedor ? " • " + texto(m.fornecedor) : "") + '</span>' +
        '<div class="qtd">' +
        '<button class="mini" data-mudar="-1" data-lista="materiais" data-id="' + m.id + '">−</button>' +
        '<span>' + numero(m.quantidade) + " " + UNIDADES[m.unidade] + '</span>' +
        '<button class="mini" data-mudar="1" data-lista="materiais" data-id="' + m.id + '">+</button>' +
        '</div></div>' +
        '<p class="desc">Mínimo: ' + numero(m.minimo) + " " + UNIDADES[m.unidade] + '</p></article>';
}

function cartaoCompra(m) {
    const precisa = Math.max(0, m.minimo - m.quantidade);
    return '<article class="item baixo">' +
        '<div class="item-topo"><strong>' + texto(nomeMaterial(m)) + '</strong>' +
        '<button class="botao pequeno" data-comprar="' + m.id + '">Comprei</button></div>' +
        '<div class="item-rodape"><span>Tem ' + numero(m.quantidade) + " " + UNIDADES[m.unidade] +
        " • mínimo " + numero(m.minimo) + '</span>' +
        '<span>' + texto(m.fornecedor || "") + '</span></div>' +
        (precisa > 0 ? '<p class="desc">Faltam pelo menos ' + numero(precisa) + " " + UNIDADES[m.unidade] + '</p>' : "") +
        '</article>';
}

function cartaoProduto(p) {
    return '<article class="item" data-tipo="produto" data-id="' + p.id + '">' +
        '<div class="item-topo"><strong>' + texto(p.nome) + '</strong><span>' + dinheiro(p.preco) + '</span></div>' +
        (p.descricao ? '<p class="desc">' + texto(p.descricao) + '</p>' : "") +
        '<div class="item-rodape"><span>' + texto(p.cores.join(", ")) + '</span>' +
        '<div class="qtd">' +
        '<button class="mini" data-mudar="-1" data-lista="produtos" data-id="' + p.id + '">−</button>' +
        '<span>' + p.quantidade + '</span>' +
        '<button class="mini" data-mudar="1" data-lista="produtos" data-id="' + p.id + '">+</button>' +
        '</div></div></article>';
}

function linkWhats(telefone, msg) {
    let n = (telefone || "").replace(/\D/g, "");
    if (!n) return null;
    if (n.length <= 11) n = "55" + n;
    return "https://wa.me/" + n + "?text=" + encodeURIComponent(msg);
}

function classeStatus(s) {
    return { "Novo": "novo", "Em produção": "producao", "Pronto": "pronto", "Entregue": "entregue" }[s];
}

function cartaoEncomenda(e) {
    const p = porId("produtos", e.produtoId);
    const dias = diasAte(e.entrega);
    let prazo = dataBR(e.entrega);
    let atrasada = false;
    if (e.status !== "Entregue" && dias !== null) {
        if (dias < 0) { prazo += " (atrasada)"; atrasada = true; }
        else if (dias === 0) prazo += " (hoje)";
        else if (dias === 1) prazo += " (amanhã)";
    }
    const zap = linkWhats(e.telefone, "Olá, " + e.cliente + "! Aqui é da Maluzinha Laços e Encantos 🎀");
    return '<article class="item' + (atrasada ? " atrasada" : "") + '" data-tipo="encomenda" data-id="' + e.id + '">' +
        '<div class="item-topo"><strong>' + texto(e.cliente) + '</strong>' +
        '<span class="status ' + classeStatus(e.status) + '">' + e.status + '</span></div>' +
        '<p>' + e.quantidade + 'x ' + texto(p ? p.nome : "Produto removido") + (e.cor ? " – " + texto(e.cor) : "") + '</p>' +
        '<div class="item-rodape"><span>📅 ' + prazo + '</span>' +
        '<span>' + dinheiro(e.valor) + (e.pago ? " ✔ pago" : " • a receber") + '</span></div>' +
        (zap ? '<a class="zap" href="' + zap + '" target="_blank" rel="noopener">Chamar no WhatsApp</a>' : "") +
        '</article>';
}

function vazio(msg) {
    return '<p class="vazio">' + msg + '</p>';
}

function textoListaCompras() {
    const falta = materiaisEmFalta();
    if (!falta.length) return "";
    return "🎀 Lista de compras – Maluzinha Laços e Encantos\n\n" +
        falta.map(m => "• " + nomeMaterial(m) + " (tenho " + numero(m.quantidade) + " " + UNIDADES[m.unidade] + ")" +
            (m.fornecedor ? " – " + m.fornecedor : "")).join("\n");
}

function desenharInicio() {
    const falta = materiaisEmFalta();
    const abertas = dados.encomendas.filter(e => e.status !== "Entregue");
    const receber = dados.encomendas.filter(e => !e.pago).reduce((s, e) => s + Number(e.valor || 0), 0);

    document.getElementById("numFalta").textContent = falta.length;
    document.getElementById("numAbertas").textContent = abertas.length;
    document.getElementById("valorReceber").textContent = dinheiro(receber);

    document.getElementById("listaInicioCompras").innerHTML = falta.length
        ? falta.slice(0, 4).map(cartaoMaterial).join("")
        : vazio(dados.materiais.length ? "Nenhum material em falta 🎀" : "Cadastre seus materiais na aba Materiais.");

    const proximas = abertas.slice().sort((a, b) => (a.entrega || "9999").localeCompare(b.entrega || "9999")).slice(0, 4);
    document.getElementById("listaProximas").innerHTML =
        proximas.length ? proximas.map(cartaoEncomenda).join("") : vazio("Nenhuma encomenda em aberto.");

    const bolinha = document.getElementById("bolinhaCompras");
    bolinha.textContent = falta.length;
    bolinha.hidden = !falta.length;
}

function desenharFiltrosCategoria() {
    const usadas = ["Todos", ...CATEGORIAS.filter(c => dados.materiais.some(m => m.categoria === c))];
    if (!usadas.includes(filtroCategoria)) filtroCategoria = "Todos";
    document.getElementById("filtrosCategoria").innerHTML = usadas.map(c =>
        '<button class="chip' + (c === filtroCategoria ? " ativo" : "") + '" data-categoria="' + c + '">' + c + '</button>').join("");
}

function desenharMateriais() {
    desenharFiltrosCategoria();
    const busca = document.getElementById("buscaMaterial").value.trim().toLowerCase();
    const lista = dados.materiais
        .filter(m => filtroCategoria === "Todos" || m.categoria === filtroCategoria)
        .filter(m => (m.nome + " " + m.cor).toLowerCase().includes(busca))
        .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
    document.getElementById("listaMateriais").innerHTML =
        lista.length ? lista.map(cartaoMaterial).join("") : vazio("Nenhum material aqui. Toque no + para cadastrar.");
}

function desenharCompras() {
    const falta = materiaisEmFalta();
    document.getElementById("listaCompras").innerHTML =
        falta.length ? falta.map(cartaoCompra).join("") : vazio("Nada para comprar agora 🎀");
    const txt = textoListaCompras();
    const botao = document.getElementById("enviarLista");
    botao.href = "https://wa.me/?text=" + encodeURIComponent(txt);
    document.querySelector(".acoes-lista").hidden = !falta.length;
}

function desenharProdutos() {
    const busca = document.getElementById("buscaProduto").value.trim().toLowerCase();
    const lista = dados.produtos.filter(p => p.nome.toLowerCase().includes(busca));
    document.getElementById("listaProdutos").innerHTML =
        lista.length ? lista.map(cartaoProduto).join("") : vazio("Nenhum produto encontrado.");
}

function desenharEncomendas() {
    const busca = document.getElementById("buscaEncomenda").value.trim().toLowerCase();
    const lista = dados.encomendas
        .filter(e => filtroStatus === "todas" || (filtroStatus === "abertas" ? e.status !== "Entregue" : e.status === filtroStatus))
        .filter(e => {
            const p = porId("produtos", e.produtoId);
            return (e.cliente + " " + (p ? p.nome : "")).toLowerCase().includes(busca);
        })
        .sort((a, b) => (a.entrega || "9999").localeCompare(b.entrega || "9999"));
    document.getElementById("listaEncomendas").innerHTML =
        lista.length ? lista.map(cartaoEncomenda).join("") : vazio("Nenhuma encomenda aqui. Toque no + para cadastrar.");
}

function desenharTudo() {
    desenharInicio();
    desenharMateriais();
    desenharCompras();
    desenharProdutos();
    desenharEncomendas();
}

function mostrarTela(nome) {
    document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
    document.getElementById("tela-" + nome).classList.add("ativa");
    document.querySelectorAll(".aba").forEach(a => a.classList.toggle("ativa", a.dataset.tela === nome));
    document.getElementById("tituloTela").textContent = nomesTela[nome];
    window.scrollTo(0, 0);
}

function abrirMaterial(id) {
    const form = document.getElementById("formMaterial");
    form.reset();
    form.categoria.innerHTML = CATEGORIAS.map(c => "<option>" + c + "</option>").join("");
    editando = id ? porId("materiais", id) : null;
    const m = editando;
    document.getElementById("tituloMaterial").textContent = m ? "Editar material" : "Novo material";
    document.getElementById("excluirMaterial").hidden = !m;
    if (m) {
        form.nome.value = m.nome;
        form.categoria.value = m.categoria;
        form.cor.value = m.cor || "";
        form.quantidade.value = m.quantidade;
        form.unidade.value = m.unidade;
        form.minimo.value = m.minimo;
        form.fornecedor.value = m.fornecedor || "";
    } else if (filtroCategoria !== "Todos") {
        form.categoria.value = filtroCategoria;
    }
    document.getElementById("dlgMaterial").showModal();
}

function salvarMaterial(ev) {
    ev.preventDefault();
    const f = ev.target;
    const novo = {
        nome: f.nome.value.trim(),
        categoria: f.categoria.value,
        cor: f.cor.value.trim(),
        quantidade: Number(f.quantidade.value),
        unidade: f.unidade.value,
        minimo: Number(f.minimo.value || 0),
        fornecedor: f.fornecedor.value.trim()
    };
    if (editando) Object.assign(editando, novo);
    else dados.materiais.push({ id: novoId(), ...novo });
    fecharESalvar("dlgMaterial", "Material salvo!");
}

function abrirCompra(id) {
    comprando = porId("materiais", id);
    const form = document.getElementById("formCompra");
    form.reset();
    document.getElementById("textoCompra").textContent =
        nomeMaterial(comprando) + " – hoje tem " + numero(comprando.quantidade) + " " + UNIDADES[comprando.unidade] + ".";
    document.getElementById("dlgCompra").showModal();
}

function salvarCompra(ev) {
    ev.preventDefault();
    comprando.quantidade = Number(comprando.quantidade) + Number(ev.target.quantidade.value);
    fecharESalvar("dlgCompra", "Estoque atualizado!");
}

function abrirProduto(id) {
    const form = document.getElementById("formProduto");
    form.reset();
    editando = id ? porId("produtos", id) : null;
    const p = editando;
    document.getElementById("tituloProduto").textContent = p ? "Editar produto" : "Novo produto";
    document.getElementById("excluirProduto").hidden = !p;
    if (p) {
        form.nome.value = p.nome;
        form.descricao.value = p.descricao || "";
        form.preco.value = p.preco;
        form.quantidade.value = p.quantidade;
        form.cores.value = p.cores.join(", ");
    }
    document.getElementById("dlgProduto").showModal();
}

function salvarProduto(ev) {
    ev.preventDefault();
    const f = ev.target;
    const novo = {
        nome: f.nome.value.trim(),
        descricao: f.descricao.value.trim(),
        preco: Number(f.preco.value),
        quantidade: Number(f.quantidade.value),
        cores: f.cores.value.split(",").map(c => c.trim()).filter(Boolean)
    };
    if (editando) Object.assign(editando, novo);
    else dados.produtos.push({ id: novoId(), ...novo });
    fecharESalvar("dlgProduto", "Produto salvo!");
}

function atualizarCores() {
    const p = porId("produtos", document.getElementById("selProduto").value);
    document.getElementById("opcoesCor").innerHTML = p ? p.cores.map(c => '<option value="' + texto(c) + '">').join("") : "";
}

function sugerirValor() {
    const f = document.getElementById("formEncomenda");
    const p = porId("produtos", f.produtoId.value);
    if (p) f.valor.value = (p.preco * Number(f.quantidade.value || 1)).toFixed(2);
}

function mexerProduto(id, qtd) {
    const p = porId("produtos", id);
    if (p) p.quantidade = Math.max(0, p.quantidade + qtd);
}

function abrirEncomenda(id) {
    const f = document.getElementById("formEncomenda");
    f.reset();
    f.produtoId.innerHTML = '<option value="">Escolha o produto</option>' +
        dados.produtos.map(p => '<option value="' + p.id + '">' + texto(p.nome) + " – " + dinheiro(p.preco) + "</option>").join("");
    editando = id ? porId("encomendas", id) : null;
    const e = editando;
    document.getElementById("tituloEncomenda").textContent = e ? "Editar encomenda" : "Nova encomenda";
    document.getElementById("excluirEncomenda").hidden = !e;
    if (e) {
        f.cliente.value = e.cliente;
        f.telefone.value = e.telefone || "";
        f.produtoId.value = e.produtoId;
        f.cor.value = e.cor || "";
        f.quantidade.value = e.quantidade;
        f.valor.value = e.valor;
        f.entrega.value = e.entrega || "";
        f.status.value = e.status;
        f.pago.checked = !!e.pago;
        f.baixarEstoque.checked = !!e.baixouEstoque;
        f.obs.value = e.obs || "";
    }
    atualizarCores();
    document.getElementById("dlgEncomenda").showModal();
}

function salvarEncomenda(ev) {
    ev.preventDefault();
    const f = ev.target;
    const nova = {
        cliente: f.cliente.value.trim(),
        telefone: f.telefone.value.trim(),
        produtoId: f.produtoId.value,
        cor: f.cor.value.trim(),
        quantidade: Number(f.quantidade.value),
        valor: Number(f.valor.value),
        entrega: f.entrega.value,
        status: f.status.value,
        pago: f.pago.checked,
        baixouEstoque: f.baixarEstoque.checked,
        obs: f.obs.value.trim()
    };
    if (editando) {
        if (editando.baixouEstoque) mexerProduto(editando.produtoId, editando.quantidade);
        Object.assign(editando, nova);
    } else {
        dados.encomendas.push({ id: novoId(), criadaEm: new Date().toISOString(), ...nova });
    }
    if (nova.baixouEstoque) mexerProduto(nova.produtoId, -nova.quantidade);
    fecharESalvar("dlgEncomenda", "Encomenda salva!");
}

function excluir(lista, dialogo) {
    if (!editando || !confirm("Tem certeza que deseja excluir?")) return;
    if (lista === "produtos" && dados.encomendas.some(e => e.produtoId === editando.id && e.status !== "Entregue")) {
        alert("Este produto está em uma encomenda em aberto.");
        return;
    }
    if (lista === "encomendas" && editando.baixouEstoque) mexerProduto(editando.produtoId, editando.quantidade);
    dados[lista] = dados[lista].filter(x => x !== editando);
    fecharESalvar(dialogo, "Excluído");
}

function fecharESalvar(dialogo, msg) {
    salvar();
    desenharTudo();
    document.getElementById(dialogo).close();
    avisar(msg);
}

function baixarArquivo(nome, conteudo, tipo) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
}

function gerarCsv(linhas) {
    return "﻿" + linhas.map(l => l.map(c => '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"').join(";")).join("\n");
}

function dataArquivo() {
    return new Date().toISOString().slice(0, 10);
}

function csvMateriais() {
    const linhas = [["Material", "Tipo", "Cor", "Quantidade", "Unidade", "Mínimo", "Onde comprar", "Precisa comprar"]];
    dados.materiais.forEach(m => linhas.push([m.nome, m.categoria, m.cor, numero(m.quantidade), m.unidade,
        numero(m.minimo), m.fornecedor, emFalta(m) ? "Sim" : "Não"]));
    baixarArquivo("materiais-maluzinha-" + dataArquivo() + ".csv", gerarCsv(linhas), "text/csv");
}

function csvEncomendas() {
    const linhas = [["Cliente", "WhatsApp", "Produto", "Cor", "Quantidade", "Valor", "Entrega", "Status", "Pago", "Observações"]];
    dados.encomendas.forEach(e => {
        const p = porId("produtos", e.produtoId);
        linhas.push([e.cliente, e.telefone, p ? p.nome : "", e.cor, e.quantidade, String(e.valor).replace(".", ","),
            dataBR(e.entrega), e.status, e.pago ? "Sim" : "Não", e.obs]);
    });
    baixarArquivo("encomendas-maluzinha-" + dataArquivo() + ".csv", gerarCsv(linhas), "text/csv");
}

function importar(ev) {
    const arquivo = ev.target.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
        try {
            const novo = JSON.parse(leitor.result);
            if (!novo.produtos) throw new Error();
            if (!confirm("Isso vai substituir os dados atuais pelos da cópia. Continuar?")) return;
            novo.materiais = novo.materiais || [];
            novo.encomendas = novo.encomendas || [];
            dados = novo;
            salvar();
            desenharTudo();
            avisar("Dados restaurados!");
        } catch (e) {
            alert("Esse arquivo não é uma cópia válida do app.");
        }
        ev.target.value = "";
    };
    leitor.readAsText(arquivo);
}

document.querySelectorAll(".aba").forEach(a => a.addEventListener("click", () => mostrarTela(a.dataset.tela)));
document.getElementById("abrirBackup").addEventListener("click", () => mostrarTela("backup"));

document.getElementById("filtrosCategoria").addEventListener("click", ev => {
    const chip = ev.target.closest(".chip");
    if (!chip) return;
    filtroCategoria = chip.dataset.categoria;
    desenharMateriais();
});

document.getElementById("filtrosStatus").addEventListener("click", ev => {
    const chip = ev.target.closest(".chip");
    if (!chip) return;
    document.querySelectorAll("#filtrosStatus .chip").forEach(c => c.classList.remove("ativo"));
    chip.classList.add("ativo");
    filtroStatus = chip.dataset.status;
    desenharEncomendas();
});

document.getElementById("buscaMaterial").addEventListener("input", desenharMateriais);
document.getElementById("buscaProduto").addEventListener("input", desenharProdutos);
document.getElementById("buscaEncomenda").addEventListener("input", desenharEncomendas);

document.getElementById("novoMaterial").addEventListener("click", () => abrirMaterial(null));
document.getElementById("novoProduto").addEventListener("click", () => abrirProduto(null));
document.getElementById("novaEncomenda").addEventListener("click", () => abrirEncomenda(null));

document.getElementById("formMaterial").addEventListener("submit", salvarMaterial);
document.getElementById("formCompra").addEventListener("submit", salvarCompra);
document.getElementById("formProduto").addEventListener("submit", salvarProduto);
document.getElementById("formEncomenda").addEventListener("submit", salvarEncomenda);

document.getElementById("excluirMaterial").addEventListener("click", () => excluir("materiais", "dlgMaterial"));
document.getElementById("excluirProduto").addEventListener("click", () => excluir("produtos", "dlgProduto"));
document.getElementById("excluirEncomenda").addEventListener("click", () => excluir("encomendas", "dlgEncomenda"));

document.getElementById("selProduto").addEventListener("change", () => { atualizarCores(); sugerirValor(); });
document.querySelector("#formEncomenda [name=quantidade]").addEventListener("input", sugerirValor);
document.querySelectorAll("[data-fechar]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));

document.getElementById("copiarLista").addEventListener("click", () => {
    navigator.clipboard.writeText(textoListaCompras()).then(() => avisar("Lista copiada!"), () => avisar("Não foi possível copiar"));
});

document.addEventListener("click", ev => {
    if (ev.target.closest("a.zap")) return;
    const mudar = ev.target.closest("[data-mudar]");
    if (mudar) {
        const item = porId(mudar.dataset.lista, mudar.dataset.id);
        item.quantidade = Math.max(0, Number(item.quantidade) + Number(mudar.dataset.mudar));
        salvar();
        desenharTudo();
        return;
    }
    const comprar = ev.target.closest("[data-comprar]");
    if (comprar) return abrirCompra(comprar.dataset.comprar);
    const item = ev.target.closest("[data-tipo]");
    if (!item) return;
    if (item.dataset.tipo === "material") abrirMaterial(item.dataset.id);
    if (item.dataset.tipo === "produto") abrirProduto(item.dataset.id);
    if (item.dataset.tipo === "encomenda") abrirEncomenda(item.dataset.id);
});

document.getElementById("exportar").addEventListener("click", () =>
    baixarArquivo("backup-maluzinha-" + dataArquivo() + ".json", JSON.stringify(dados, null, 2), "application/json"));
document.getElementById("csvMateriais").addEventListener("click", csvMateriais);
document.getElementById("csvEncomendas").addEventListener("click", csvEncomendas);
document.getElementById("importar").addEventListener("change", importar);

desenharTudo();
