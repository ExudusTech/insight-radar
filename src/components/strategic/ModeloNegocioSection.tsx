const styles = `
  .mn-page { max-width: 860px; margin: 0 auto; padding: 40px 0 80px; font-family: 'Inter', sans-serif; line-height: 1.7; }

  .mn-hero { position: relative; margin-bottom: 48px; padding-bottom: 32px; border-bottom: 1px solid rgba(6,182,212,0.15); }
  .mn-tag { display: inline-flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #06B6D4; border: 1px solid rgba(6,182,212,0.3); border-radius: 4px; padding: 4px 10px; margin-bottom: 20px; letter-spacing: 0.08em; text-transform: uppercase; }
  .mn-tag-dot { width: 6px; height: 6px; background: #06B6D4; border-radius: 50%; }
  .mn-h1 { font-family: 'Syne', sans-serif; font-size: 40px; font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; color: #fff; margin-bottom: 14px; }
  .mn-h1 span { background: linear-gradient(90deg, #06B6D4, #1D4ED8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .mn-hero-sub { font-size: 15.5px; color: #94A3B8; max-width: 620px; font-weight: 300; }
  .mn-hero-note { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #64748B; margin-top: 12px; }

  .mn-h2 { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 18px; display: flex; align-items: center; gap: 12px; }
  .mn-h2-line { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(6,182,212,0.2), transparent); }

  .mn-section { margin-bottom: 52px; }

  /* Metric cards */
  .mn-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .mn-metric { background: #0D1526; border: 1px solid rgba(6,182,212,0.15); border-radius: 8px; padding: 22px 24px; position: relative; overflow: hidden; }
  .mn-metric-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
  .mn-metric-value { font-family: 'Syne', sans-serif; font-size: 30px; font-weight: 800; color: #fff; line-height: 1; margin-bottom: 6px; }
  .mn-metric-value.good { color: #4ADE80; }
  .mn-metric-value.blue { color: #60A5FA; }
  .mn-metric-sub { font-size: 12px; color: #94A3B8; }
  .mn-metric.hi { border-left: 3px solid #06B6D4; }

  /* Cost breakdown */
  .mn-cost { background: #0D1526; border: 1px solid rgba(29,78,216,0.2); border-radius: 8px; padding: 24px 28px; }
  .mn-cost-row { display: grid; grid-template-columns: 1fr 90px 60px; gap: 14px; align-items: center; padding: 10px 0; border-bottom: 1px dashed rgba(148,163,184,0.08); }
  .mn-cost-row:last-of-type { border-bottom: none; }
  .mn-cost-row.total { border-top: 1px solid rgba(6,182,212,0.3); margin-top: 6px; padding-top: 14px; }
  .mn-cost-label { font-size: 13.5px; color: #E2E8F0; }
  .mn-cost-value { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #E2E8F0; text-align: right; }
  .mn-cost-pct { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #64748B; text-align: right; }
  .mn-cost-bar { grid-column: 1 / -1; height: 4px; background: rgba(148,163,184,0.08); border-radius: 2px; overflow: hidden; margin-top: 6px; }
  .mn-cost-bar-fill { height: 100%; background: linear-gradient(90deg, #1D4ED8, #06B6D4); }
  .mn-cost-bar-fill.muted { background: rgba(148,163,184,0.3); }
  .mn-cost-bar-fill.warn { background: #F59E0B; }
  .mn-cost-bar-fill.dim { background: rgba(74,222,128,0.5); }

  /* Pricing table */
  .mn-plans { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .mn-plan { background: #0D1526; border: 1px solid rgba(6,182,212,0.12); border-radius: 8px; padding: 20px 22px; position: relative; }
  .mn-plan.star { border-color: rgba(6,182,212,0.4); box-shadow: 0 0 0 1px rgba(6,182,212,0.15); }
  .mn-plan-star { position: absolute; top: 12px; right: 14px; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #06B6D4; letter-spacing: 0.08em; text-transform: uppercase; }
  .mn-plan-name { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 4px; }
  .mn-plan-scope { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px; }
  .mn-plan-price { font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800; color: #fff; }
  .mn-plan-meta { display: flex; gap: 16px; margin-top: 10px; font-size: 12px; color: #94A3B8; }
  .mn-plan-meta strong { color: #4ADE80; font-family: 'JetBrains Mono', monospace; font-weight: 500; }

  /* Break-even card */
  .mn-be { background: #0D1526; border: 1px solid rgba(74,222,128,0.2); border-left: 3px solid #4ADE80; border-radius: 8px; padding: 22px 28px; display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: center; }
  .mn-be-text { font-size: 13.5px; color: #94A3B8; }
  .mn-be-text strong { color: #E2E8F0; }
  .mn-be-value { font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 800; color: #4ADE80; line-height: 1; }
  .mn-be-value-l { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 6px; text-align: right; }

  /* Projection */
  .mn-proj { background: #0D1526; border: 1px solid rgba(29,78,216,0.15); border-radius: 8px; padding: 24px 28px; }
  .mn-proj-chart { display: flex; align-items: flex-end; gap: 10px; height: 180px; margin-bottom: 20px; padding-top: 12px; }
  .mn-proj-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .mn-proj-bar { width: 100%; background: linear-gradient(180deg, #06B6D4, #1D4ED8); border-radius: 3px 3px 0 0; position: relative; min-height: 8px; transition: opacity 0.2s; }
  .mn-proj-bar:hover { opacity: 0.85; }
  .mn-proj-bar-v { position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #E2E8F0; white-space: nowrap; }
  .mn-proj-label { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; text-align: center; line-height: 1.3; }
  .mn-proj-table { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; font-size: 12px; }
  .mn-proj-table > div { padding: 8px 6px; border-bottom: 1px dashed rgba(148,163,184,0.08); color: #94A3B8; }
  .mn-proj-table .h { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid rgba(6,182,212,0.2); }
  .mn-proj-table .v { font-family: 'JetBrains Mono', monospace; color: #E2E8F0; text-align: right; }

  /* Insight */
  .mn-insight { background: linear-gradient(135deg, rgba(6,182,212,0.08), rgba(29,78,216,0.05)); border: 1px solid rgba(6,182,212,0.3); border-radius: 8px; padding: 28px 32px; text-align: center; position: relative; overflow: hidden; }
  .mn-insight::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(6,182,212,0.08), transparent 70%); pointer-events: none; }
  .mn-insight-v { font-family: 'Syne', sans-serif; font-size: 44px; font-weight: 800; color: #06B6D4; line-height: 1; margin-bottom: 12px; letter-spacing: -0.02em; }
  .mn-insight-t { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 600; color: #fff; margin-bottom: 6px; }
  .mn-insight-s { font-size: 13px; color: #94A3B8; max-width: 500px; margin: 0 auto; }

  /* Phase 2 */
  .mn-phase2 { background: #0D1526; border: 1px solid rgba(139,92,246,0.2); border-left: 3px solid #A78BFA; border-radius: 8px; padding: 24px 28px; }
  .mn-phase2-tag { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #A78BFA; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
  .mn-phase2-h { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 10px; }
  .mn-phase2-p { font-size: 13.5px; color: #94A3B8; }
  .mn-phase2-p strong { color: #E2E8F0; }

  @media (max-width: 760px) {
    .mn-metrics { grid-template-columns: 1fr; }
    .mn-plans { grid-template-columns: 1fr; }
    .mn-be { grid-template-columns: 1fr; }
    .mn-proj-table { grid-template-columns: 1fr 1fr; font-size: 11px; }
  }
`;

type CostRow = { label: string; value: string; pct: number; tone: "primary" | "muted" | "warn" | "dim" };

const COSTS: CostRow[] = [
  { label: "Analista (20h por missão)", value: "R$ 650", pct: 47, tone: "primary" },
  { label: "Coordenador (5h supervisão)", value: "R$ 500", pct: 37, tone: "muted" },
  { label: "Overhead operacional", value: "R$ 200", pct: 15, tone: "warn" },
  { label: "Plataforma + IA", value: "R$ 7", pct: 0.5, tone: "dim" },
];

const PLANS = [
  { name: "Mapeamento Básico", scope: "3 alvos", price: "R$ 3.100", cost: "~R$ 820", margin: "74%", star: false },
  { name: "Inteligência Padrão", scope: "5–6 alvos", price: "R$ 4.500", cost: "~R$ 1.357", margin: "70%", star: true },
  { name: "Mystery Shopping Pro", scope: "8–10 alvos", price: "R$ 7.000", cost: "~R$ 2.114", margin: "70%", star: false },
  { name: "Enterprise Custom", scope: "15+ alvos", price: "R$ 12.000+", cost: "negociado", margin: "65%+", star: false },
];

const PROJECTION = [
  { period: "Jul–Ago 26", missions: "2", revenue: 9000, acc: "R$ 18k" },
  { period: "Set–Out 26", missions: "4", revenue: 18000, acc: "R$ 54k" },
  { period: "Nov–Dez 26", missions: "8", revenue: 36000, acc: "R$ 126k" },
  { period: "Jan–Mar 27", missions: "10–12", revenue: 49500, acc: "R$ 274k" },
  { period: "Abr–Jun 27", missions: "14 + SaaS", revenue: 63000, acc: "R$ 463k" },
  { period: "Jul–Dez 27", missions: "Serv+SaaS", revenue: 100000, acc: "R$ 1M+" },
];

export function ModeloNegocioSection() {
  const maxRev = Math.max(...PROJECTION.map((p) => p.revenue));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="mn-page">
        <div className="mn-hero">
          <div className="mn-tag"><span className="mn-tag-dot" />Modelo de Negócio</div>
          <h1 className="mn-h1">
            0,5% do custo é <span>tecnologia</span>.<br />
            99,5% é entregável.
          </h1>
          <p className="mn-hero-sub">
            Estrutura de receita, precificação e unit economics do Radar de Mercado IA — baseada em custos reais de infraestrutura medidos em 03/jul/2026.
          </p>
          <div className="mn-hero-note">// Dados-base: US$ 0,96 por missão completa (6 alvos + 1 relatório)</div>
        </div>

        {/* Metrics */}
        <section className="mn-section">
          <h2 className="mn-h2">Métricas-chave <span className="mn-h2-line" /></h2>
          <div className="mn-metrics">
            <div className="mn-metric hi">
              <div className="mn-metric-label">Custo tech / missão</div>
              <div className="mn-metric-value good">R$ 7</div>
              <div className="mn-metric-sub">Supabase + Claude Haiku/Sonnet</div>
            </div>
            <div className="mn-metric">
              <div className="mn-metric-label">Ticket médio</div>
              <div className="mn-metric-value blue">R$ 4.500</div>
              <div className="mn-metric-sub">Plano Inteligência Padrão</div>
            </div>
            <div className="mn-metric">
              <div className="mn-metric-label">Margem operacional</div>
              <div className="mn-metric-value good">70%</div>
              <div className="mn-metric-sub">Média ponderada dos planos</div>
            </div>
          </div>
        </section>

        {/* Cost breakdown */}
        <section className="mn-section">
          <h2 className="mn-h2">Estrutura de custo por missão <span className="mn-h2-line" /></h2>
          <div className="mn-cost">
            {COSTS.map((c) => (
              <div className="mn-cost-row" key={c.label} style={{ display: "block" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 60px", gap: 14, alignItems: "center" }}>
                  <div className="mn-cost-label">{c.label}</div>
                  <div className="mn-cost-value">{c.value}</div>
                  <div className="mn-cost-pct">{c.pct}%</div>
                </div>
                <div className="mn-cost-bar">
                  <div className={`mn-cost-bar-fill ${c.tone === "primary" ? "" : c.tone}`} style={{ width: `${Math.max(c.pct, 1)}%` }} />
                </div>
              </div>
            ))}
            <div className="mn-cost-row total">
              <div className="mn-cost-label" style={{ fontWeight: 600, color: "#fff" }}>Total variável</div>
              <div className="mn-cost-value" style={{ color: "#06B6D4", fontWeight: 600 }}>R$ 1.357</div>
              <div className="mn-cost-pct" style={{ color: "#06B6D4" }}>100%</div>
            </div>
          </div>
        </section>

        {/* Plans */}
        <section className="mn-section">
          <h2 className="mn-h2">Tabela de preços <span className="mn-h2-line" /></h2>
          <div className="mn-plans">
            {PLANS.map((p) => (
              <div className={`mn-plan ${p.star ? "star" : ""}`} key={p.name}>
                {p.star && <div className="mn-plan-star">★ Destaque</div>}
                <div className="mn-plan-name">{p.name}</div>
                <div className="mn-plan-scope">{p.scope}</div>
                <div className="mn-plan-price">{p.price}</div>
                <div className="mn-plan-meta">
                  <span>Custo: {p.cost}</span>
                  <span>Margem: <strong>{p.margin}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Break-even */}
        <section className="mn-section">
          <h2 className="mn-h2">Break-even operacional <span className="mn-h2-line" /></h2>
          <div className="mn-be">
            <div className="mn-be-text">
              Time mínimo (<strong>1 coordenador + 1 analista + infra</strong>) = <strong>R$ 7.700/mês</strong> de custo fixo.
              <br />
              Com margem de <strong>R$ 3.143 por missão</strong> no plano padrão, o ponto de equilíbrio é atingido em:
            </div>
            <div>
              <div className="mn-be-value">2,4</div>
              <div className="mn-be-value-l">missões / mês</div>
            </div>
          </div>
        </section>

        {/* Projection */}
        <section className="mn-section">
          <h2 className="mn-h2">Projeção de receita (conservadora) <span className="mn-h2-line" /></h2>
          <div className="mn-proj">
            <div className="mn-proj-chart">
              {PROJECTION.map((p) => {
                const h = (p.revenue / maxRev) * 100;
                return (
                  <div className="mn-proj-col" key={p.period}>
                    <div className="mn-proj-bar" style={{ height: `${h}%` }}>
                      <div className="mn-proj-bar-v">R$ {(p.revenue / 1000).toFixed(0)}k</div>
                    </div>
                    <div className="mn-proj-label">{p.period}</div>
                  </div>
                );
              })}
            </div>
            <div className="mn-proj-table">
              <div className="h">Período</div>
              <div className="h" style={{ textAlign: "right" }}>Missões / mês</div>
              <div className="h" style={{ textAlign: "right" }}>Receita / mês</div>
              <div className="h" style={{ textAlign: "right" }}>Acumulado</div>
              {PROJECTION.map((p) => (
                <>
                  <div key={`${p.period}-p`}>{p.period}</div>
                  <div className="v" key={`${p.period}-m`}>{p.missions}</div>
                  <div className="v" key={`${p.period}-r`}>R$ {p.revenue.toLocaleString("pt-BR")}</div>
                  <div className="v" key={`${p.period}-a`}>{p.acc}</div>
                </>
              ))}
            </div>
          </div>
        </section>

        {/* Insight */}
        <section className="mn-section">
          <div className="mn-insight">
            <div className="mn-insight-v">0,5%</div>
            <div className="mn-insight-t">do custo por missão é tecnologia</div>
            <div className="mn-insight-s">
              A IA não é custo — é alavanca. Um analista guiado pela plataforma cobre 3–4× mais alvos por hora.
              Com escala, o custo humano efetivo cai sem sacrificar qualidade ou margem.
            </div>
          </div>
        </section>

        {/* Phase 2 */}
        <section className="mn-section" style={{ marginBottom: 0 }}>
          <h2 className="mn-h2">Fase 2 — SaaS white-label (2027) <span className="mn-h2-line" /></h2>
          <div className="mn-phase2">
            <div className="mn-phase2-tag">// próximo horizonte</div>
            <div className="mn-phase2-h">Cliente traz os analistas, ExudusTech fornece a plataforma</div>
            <div className="mn-phase2-p">
              Ticket recorrente de <strong>R$ 1.500 a R$ 5.000/conta/mês</strong>, com margem superior a <strong>90%</strong> —
              custo apenas de infraestrutura e suporte. Modelo escalável sem crescimento linear de headcount operacional.
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
