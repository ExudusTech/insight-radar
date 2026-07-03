import { useEffect, useRef } from "react";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&family=Inter:wght@300;400;500;600&display=swap');

  .os-page { max-width: 860px; margin: 0 auto; padding: 0 0 80px; font-family: 'Inter', sans-serif; line-height: 1.7; }

  .os-hero { position: relative; margin-bottom: 64px; padding-bottom: 40px; border-bottom: 1px solid rgba(6,182,212,0.15); }
  .os-hero::before { content: ''; position: absolute; top: -60px; left: -60px; width: 360px; height: 360px; background: radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 70%); pointer-events: none; }

  .os-tag { display: inline-flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #06B6D4; border: 1px solid rgba(6,182,212,0.3); border-radius: 4px; padding: 4px 10px; margin-bottom: 20px; letter-spacing: 0.08em; text-transform: uppercase; }
  .os-tag-dot { width: 6px; height: 6px; background: #06B6D4; border-radius: 50%; animation: os-pulse 2s ease-in-out infinite; }
  @keyframes os-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

  .os-h1 { font-family: 'Syne', sans-serif; font-size: 44px; font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; color: #fff; margin-bottom: 16px; }
  .os-h1 span { background: linear-gradient(90deg, #06B6D4, #1D4ED8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .os-hero-sub { font-size: 16px; color: #94A3B8; max-width: 580px; font-weight: 300; }

  .os-h2 { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 18px; display: flex; align-items: center; gap: 12px; }
  .os-h2-line { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(6,182,212,0.2), transparent); }

  .os-section { margin-bottom: 60px; }

  .os-problem { background: #0D1526; border: 1px solid rgba(29,78,216,0.2); border-left: 3px solid #DC2626; border-radius: 8px; padding: 28px 32px; position: relative; overflow: hidden; }
  .os-problem::after { content: ''; position: absolute; top:0; right:0; width:220px; height:100%; background: radial-gradient(ellipse at right, rgba(220,38,38,0.05), transparent); pointer-events:none; }
  .os-problem p { color: #94A3B8; font-size: 14.5px; margin-bottom: 12px; }
  .os-problem p:last-of-type { margin-bottom: 0; }
  .os-problem strong { color: #E2E8F0; }

  .os-stats { display: flex; gap: 16px; margin-top: 24px; flex-wrap: wrap; }
  .os-stat { background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.2); border-radius: 6px; padding: 10px 18px; text-align: center; }
  .os-stat-v { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; color: #F87171; display: block; }
  .os-stat-l { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; }

  .os-solution { background: #0D1526; border: 1px solid rgba(6,182,212,0.15); border-left: 3px solid #06B6D4; border-radius: 8px; padding: 28px 32px; position: relative; overflow: hidden; }
  .os-solution::after { content:''; position:absolute; top:0; right:0; width:280px; height:100%; background:radial-gradient(ellipse at right,rgba(6,182,212,0.05),transparent); pointer-events:none; }
  .os-solution p { color: #94A3B8; font-size: 14.5px; margin-bottom: 12px; }
  .os-solution p:last-child { margin-bottom: 0; }
  .os-solution strong { color: #E2E8F0; }

  .os-phases { display: flex; flex-direction: column; }
  .os-phase { display: grid; grid-template-columns: 56px 1fr; gap: 0 20px; }
  .os-spine { display: flex; flex-direction: column; align-items: center; }
  .os-num { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 500; flex-shrink: 0; position: relative; z-index: 1; }
  .os-vline { width: 2px; flex: 1; min-height: 28px; margin: 4px 0; }
  .os-phase:last-child .os-vline { display: none; }
  .os-pbody { padding-bottom: 36px; }
  .os-phase:last-child .os-pbody { padding-bottom: 0; }
  .os-plabel { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; margin-bottom: 6px; margin-top: 7px; color: #fff; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .os-psub { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; padding: 2px 8px; border-radius: 3px; font-weight: 500; }
  .os-pdesc { font-size: 13.5px; color: #94A3B8; line-height: 1.6; }
  .os-pbullets { margin-top: 8px; display: flex; flex-direction: column; gap: 3px; }
  .os-pbullet { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; color: #64748B; }
  .os-pbullet::before { content: '→'; font-family: 'JetBrains Mono', monospace; font-size: 10px; margin-top: 3px; flex-shrink: 0; }

  .ph1 .os-num { background: rgba(29,78,216,0.15); border: 1.5px solid rgba(29,78,216,0.4); color: #60A5FA; }
  .ph1 .os-vline { background: linear-gradient(to bottom, rgba(29,78,216,0.3), rgba(6,182,212,0.1)); }
  .ph1 .os-psub { background: rgba(29,78,216,0.1); color: #60A5FA; }
  .ph1 .os-pbullet::before { color: #60A5FA; }
  .ph2 .os-num { background: rgba(6,182,212,0.12); border: 1.5px solid rgba(6,182,212,0.35); color: #06B6D4; }
  .ph2 .os-vline { background: linear-gradient(to bottom, rgba(6,182,212,0.25), rgba(245,158,11,0.1)); }
  .ph2 .os-psub { background: rgba(6,182,212,0.08); color: #06B6D4; }
  .ph2 .os-pbullet::before { color: #06B6D4; }
  .ph3 .os-num { background: rgba(245,158,11,0.1); border: 1.5px solid rgba(245,158,11,0.3); color: #F59E0B; }
  .ph3 .os-vline { background: linear-gradient(to bottom, rgba(245,158,11,0.2), rgba(22,163,74,0.15)); }
  .ph3 .os-psub { background: rgba(245,158,11,0.08); color: #F59E0B; }
  .ph3 .os-pbullet::before { color: #F59E0B; }
  .ph4 .os-num { background: rgba(22,163,74,0.1); border: 1.5px solid rgba(22,163,74,0.3); color: #4ADE80; }
  .ph4 .os-vline { background: linear-gradient(to bottom, rgba(22,163,74,0.2), rgba(139,92,246,0.1)); }
  .ph4 .os-psub { background: rgba(22,163,74,0.08); color: #4ADE80; }
  .ph4 .os-pbullet::before { color: #4ADE80; }
  .ph5 .os-num { background: rgba(139,92,246,0.1); border: 1.5px solid rgba(139,92,246,0.3); color: #A78BFA; }
  .ph5 .os-psub { background: rgba(139,92,246,0.08); color: #A78BFA; }
  .ph5 .os-pbullet::before { color: #A78BFA; }

  .os-arch { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
  .os-arch-card { background: #0D1526; border: 1px solid rgba(6,182,212,0.12); border-radius: 8px; padding: 18px 20px; transition: border-color 0.2s; }
  .os-arch-card:hover { border-color: rgba(6,182,212,0.3); }
  .os-arch-icon { width: 34px; height: 34px; border-radius: 7px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; font-size: 16px; }
  .os-arch-name { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 4px; }
  .os-arch-desc { font-size: 12px; color: #64748B; line-height: 1.5; }

  .os-table-wrap { background: #0D1526; border: 1px solid rgba(6,182,212,0.12); border-radius: 8px; overflow: hidden; }
  .os-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .os-table thead tr { background: #121D35; }
  .os-table th { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748B; padding: 10px 16px; text-align: left; border-bottom: 1px solid rgba(6,182,212,0.1); }
  .os-table td { padding: 9px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); color: #94A3B8; vertical-align: middle; }
  .os-table tr:last-child td { border-bottom: none; }
  .os-table tr:hover td { background: rgba(6,182,212,0.03); }
  .os-badge { font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 500; }
  .os-primary { color: #06B6D4; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  .os-fallback { color: #475569; font-family: 'JetBrains Mono', monospace; font-size: 11px; }

  .os-metrics { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
  .os-metric { background: #0D1526; border: 1px solid rgba(6,182,212,0.12); border-radius: 8px; padding: 18px 20px; display: flex; align-items: flex-start; gap: 14px; }
  .os-mdot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
  .os-mtitle { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 4px; }
  .os-mdesc { font-size: 12px; color: #64748B; line-height: 1.5; }

  .os-footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid rgba(6,182,212,0.1); display: flex; align-items: center; justify-content: space-between; }
  .os-footer span { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #475569; }
  .os-ver { background: rgba(6,182,212,0.08); border: 1px solid rgba(6,182,212,0.2); border-radius: 4px; padding: 3px 10px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #06B6D4; }
`;

export function OSystemaSection() {
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = styles;
    document.head.appendChild(el);
    styleRef.current = el;
    return () => { el.remove(); };
  }, []);

  return (
    <div className="os-page">

      {/* HERO */}
      <div className="os-hero">
        <div className="os-tag"><span className="os-tag-dot" />Visão Estratégica — Documento 01</div>
        <h1 className="os-h1">O <span>Sistema</span></h1>
        <p className="os-hero-sub">O que é, qual problema resolve, como funciona, e qual inteligência artificial opera em cada fase do processo.</p>
      </div>

      {/* PROBLEMA */}
      <div className="os-section">
        <h2 className="os-h2">O Problema <span className="os-h2-line" /></h2>
        <div className="os-problem">
          <p>Toda empresa que compete em um mercado precisa entender seus concorrentes. Precisa saber como vendem, o que cobram, como comunicam, como atendem. Esse trabalho existe hoje — mas é feito de forma <strong>artesanal, desorganizada e cara.</strong></p>
          <p>A realidade nas PMEs e consultorias: uma planilha no Drive com abas para cada concorrente, mensagens no WhatsApp coordenando quem pesquisa o quê, arquivos desconexos sem metodologia. O resultado chega semanas depois, incompleto, sem rastreabilidade.</p>
          <p>As alternativas formais — agências de mystery shopping — resolvem o problema a um custo proibitivo para a maioria das empresas. Sem dashboard, sem metodologia replicável, sem entrega contínua.</p>
          <div className="os-stats">
            <div className="os-stat"><span className="os-stat-v">R$15k–50k</span><span className="os-stat-l">Custo por estudo em agências</span></div>
            <div className="os-stat"><span className="os-stat-v">Zero</span><span className="os-stat-l">Rastreabilidade no método atual</span></div>
            <div className="os-stat"><span className="os-stat-v">Semanas</span><span className="os-stat-l">Tempo de entrega sem sistema</span></div>
          </div>
        </div>
      </div>

      {/* SOLUÇÃO */}
      <div className="os-section">
        <h2 className="os-h2">A Solução <span className="os-h2-line" /></h2>
        <div className="os-solution">
          <p>O <strong>Radar de Mercado IA</strong> é uma plataforma SaaS B2B que transforma missões de inteligência de mercado em processos estruturados, rastreáveis e conduzidos por inteligência artificial.</p>
          <p>O cliente define o objetivo. Os analistas executam a pesquisa de campo, guiados pela IA a cada passo. A plataforma organiza tudo, mede tudo e entrega um parecer consolidado com análise comparativa.</p>
          <p><strong>Agnóstico de segmento:</strong> o briefing define o contexto e a IA adapta o roteiro de coleta para aquele mercado — de padarias a clínicas, escritórios de advocacia a consultorias.</p>
        </div>
      </div>

      {/* FASES */}
      <div className="os-section">
        <h2 className="os-h2">Como Funciona <span className="os-h2-line" /></h2>
        <div className="os-phases">
          {[
            { cls:"ph1", num:"01", label:"Briefing", sub:"IA extrai e questiona", desc:"O cliente inicia uma missão descrevendo o que quer investigar — via documento carregado ou perguntas guiadas pela IA. O sistema extrai automaticamente os concorrentes-alvo, canais obrigatórios e entregável esperado. Se alguma informação estiver ausente, a IA pergunta antes de prosseguir.", bullets:["Extração automática do documento-base","Captura do entregável esperado (proposta comercial, pricing, deck de vendas)","Definição de canais obrigatórios de cobertura"] },
            { cls:"ph2", num:"02", label:"Coleta Guiada", sub:"IA conduz o analista", desc:"O analista é conduzido por um assistente de IA em uma conversa estruturada por concorrente. A IA sabe o briefing, sabe o entregável esperado e orienta passo a passo. À medida que o analista relata, a IA registra automaticamente eventos no Timeline do concorrente.", bullets:["Script de abordagem com persona definida no briefing","Timeline automático: contato → resposta → call → proposta recebida","Múltiplos concorrentes em paralelo — analista não precisa esperar respostas"] },
            { cls:"ph3", num:"03", label:"Análise", sub:"IA sugere insights", desc:"Durante e após a coleta, a IA sugere análises incrementais por bloco de dados: posicionamento, ofertas, canais, prova social, processo de vendas. Valida se o entregável esperado foi obtido antes de marcar o concorrente como concluído.", bullets:["Análise por 7 blocos estruturados (A–G)","Gate de qualidade: entregável esperado deve estar documentado","Identificação automática de lacunas ainda não cobertas"] },
            { cls:"ph4", num:"04", label:"Entrega", sub:"IA consolida e valida", desc:"Com todos os concorrentes cobertos, a IA consolida em três camadas: parecer individual por concorrente, tabela comparativa e parecer consolidado da missão. O coordenador revisa e aprova antes da entrega ao cliente.", bullets:["Parecer individual com análise aprofundada de cada player","Tabela comparativa automatizada — mesmos critérios para todos","Parecer consolidado com gaps identificados e recomendações"] },
            { cls:"ph5", num:"05", label:"Pós-entrega", sub:"Cliente explora com IA", desc:"O cliente pode continuar interagindo com a IA sobre o estudo entregue: fazer perguntas em linguagem natural, pedir análises adicionais, solicitar o material em diferentes formatos ou receber por e-mail.", bullets:["Motor de consulta em linguagem natural sobre o estudo","Exportação e envio por e-mail a qualquer momento"] },
          ].map((ph) => (
            <div key={ph.num} className={`os-phase ${ph.cls}`}>
              <div className="os-spine">
                <div className="os-num">{ph.num}</div>
                <div className="os-vline" />
              </div>
              <div className="os-pbody">
                <div className="os-plabel">{ph.label} <span className="os-psub">{ph.sub}</span></div>
                <p className="os-pdesc">{ph.desc}</p>
                <div className="os-pbullets">
                  {ph.bullets.map((b, i) => <div key={i} className="os-pbullet">{b}</div>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ARQUITETURA */}
      <div className="os-section">
        <h2 className="os-h2">Arquitetura <span className="os-h2-line" /></h2>
        <div className="os-arch">
          <div className="os-arch-card"><div className="os-arch-icon" style={{background:"rgba(29,78,216,0.1)"}}>⚛</div><div className="os-arch-name">Frontend</div><div className="os-arch-desc">React + TypeScript + Tailwind CSS. Interface de cockpit executivo, sóbria e analítica.</div></div>
          <div className="os-arch-card"><div className="os-arch-icon" style={{background:"rgba(6,182,212,0.1)"}}>🗄</div><div className="os-arch-name">Backend — Supabase</div><div className="os-arch-desc">PostgreSQL + Auth + Storage + Edge Functions + Realtime. RLS garante isolamento completo entre missões.</div></div>
          <div className="os-arch-card"><div className="os-arch-icon" style={{background:"rgba(22,163,74,0.1)"}}>🔀</div><div className="os-arch-name">LLM Router</div><div className="os-arch-desc">Sistema proprietário que encadeia Anthropic Claude, OpenAI e Google Gemini com fallback automático por tarefa.</div></div>
        </div>
      </div>

      {/* IA POR TAREFA */}
      <div className="os-section">
        <h2 className="os-h2">IA por Tarefa <span className="os-h2-line" /></h2>
        <div className="os-table-wrap">
          <table className="os-table">
            <thead><tr><th>Tarefa</th><th>Modelo Primário</th><th>Fallback</th></tr></thead>
            <tbody>
              {[
                { task:"Extração de documento", bg:"rgba(29,78,216,0.1)", color:"#60A5FA", primary:"Claude Sonnet", fb:"GPT-4o → Gemini Flash" },
                { task:"Assistente da analista", bg:"rgba(6,182,212,0.08)", color:"#06B6D4", primary:"Gemini Flash", fb:"Claude Haiku → GPT-4o mini" },
                { task:"Geração de relatório", bg:"rgba(245,158,11,0.08)", color:"#F59E0B", primary:"Claude Opus", fb:"GPT-4o → Gemini Flash" },
                { task:"Detecção de eventos", bg:"rgba(22,163,74,0.08)", color:"#4ADE80", primary:"Gemini Flash", fb:"GPT-4o mini → Claude Haiku" },
                { task:"Consulta pós-entrega", bg:"rgba(139,92,246,0.08)", color:"#A78BFA", primary:"Claude Sonnet", fb:"GPT-4o → Gemini Flash" },
              ].map((r) => (
                <tr key={r.task}>
                  <td><span className="os-badge" style={{background:r.bg, color:r.color}}>{r.task}</span></td>
                  <td className="os-primary">{r.primary}</td>
                  <td className="os-fallback">{r.fb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RASTREABILIDADE */}
      <div className="os-section">
        <h2 className="os-h2">Rastreabilidade <span className="os-h2-line" /></h2>
        <div className="os-metrics">
          <div className="os-metric"><div className="os-mdot" style={{background:"#06B6D4"}} /><div><div className="os-mtitle">Tempo por analista</div><div className="os-mdesc">Cada mensagem é timestampada. O sistema calcula tempo ativo por concorrente, por analista e por missão.</div></div></div>
          <div className="os-metric"><div className="os-mdot" style={{background:"#4ADE80"}} /><div><div className="os-mtitle">Timeline de jornada</div><div className="os-mdesc">Sequência cronológica completa do mystery shopping: primeiro contato, resposta, call, proposta recebida.</div></div></div>
          <div className="os-metric"><div className="os-mdot" style={{background:"#A78BFA"}} /><div><div className="os-mtitle">Histórico de coleta</div><div className="os-mdesc">Cada campo preenchido, cada bloco concluído, cada evidência — rastreável com autor e data.</div></div></div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="os-footer">
        <span>Radar de Mercado IA · ExudusTech · Documento Interno</span>
        <span className="os-ver">v1.0 · Jul 2026</span>
      </div>

    </div>
  );
}