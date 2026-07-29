"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Project = {
  id: string;
  name: string;
  address: string | null;
  status: string;
  currentStage: string;
  createdAt: string;
  updatedAt: string;
};

type DashboardUser = {
  name: string;
  email: string;
  authenticated: boolean;
};

const stages = [
  "场地分析",
  "户型需求",
  "平面方案",
  "建筑风格",
  "三维简模",
  "方案文档",
];

const stageLabel: Record<string, string> = {
  DRAFT: "待上传",
  SITE_REVIEW: "待确认场地",
  REQUIREMENT_DRAFT: "填写需求",
  PLAN_REVIEW: "确认平面",
  COMPLETED: "已完成",
};

export function ProjectDashboard({ user }: { user: DashboardUser }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const authHeaders: Record<string, string> = user.authenticated
    ? {}
    : {
        "x-demo-user-email": user.email,
        "x-demo-user-name": encodeURIComponent(user.name),
        "x-demo-user-name-encoding": "percent-encoded-utf-8",
      };

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/projects", { headers: authHeaders });
      if (!response.ok) throw new Error("项目列表暂时无法读取");
      const payload = (await response.json()) as { projects: Project[] };
      setProjects(payload.projects);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [user.email, user.name]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders },
        body: JSON.stringify({ name: name.trim(), address: address.trim() }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "创建项目失败");
      }
      const payload = (await response.json()) as { project: Project };
      setProjects((current) => [payload.project, ...current]);
      setName("");
      setAddress("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="筑想家首页">
          <span className="brand-mark">筑</span>
          <span>
            <strong>筑想家</strong>
            <small>自建房智能方案</small>
          </span>
        </a>
        <nav className="topnav" aria-label="主导航">
          <a className="active" href="#projects">项目</a>
          <a href="#workflow">流程</a>
          <a href="/api/health">系统状态</a>
        </nav>
        <div className="account">
          <span className="avatar">{user.name.slice(0, 1)}</span>
          <span className="account-copy">
            <strong>{user.name}</strong>
            <small>{user.authenticated ? "ChatGPT 已登录" : "本地演示模式"}</small>
          </span>
          {user.authenticated ? (
            <a className="text-link" href="/signout-with-chatgpt?return_to=/">退出</a>
          ) : (
            <a className="text-link" href="/login">登录</a>
          )}
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">DAY 2 · 项目工作台</p>
          <h1>从一张地块图，<br />到可沟通的家。</h1>
          <p className="hero-copy">
            创建项目，上传标准 DXF，系统将统一管理场地、版本、文件和异步生成任务。
          </p>
          <a className="primary-action" href="#new-project">创建新项目 <span>→</span></a>
        </div>
        <div className="site-card" aria-label="DXF 场地数据示意">
          <div className="site-card-head">
            <span>地块预检</span>
            <span className="success-dot">解析服务就绪</span>
          </div>
          <div className="site-shape">
            <div className="north">N ↑</div>
            <div className="plot">
              <span className="dimension dimension-x">18.0 m</span>
              <span className="dimension dimension-y">24.0 m</span>
            </div>
            <div className="road">村道 · 6 m</div>
          </div>
          <div className="metric-row">
            <span><small>面积</small><strong>432 m²</strong></span>
            <span><small>周长</small><strong>84 m</strong></span>
            <span><small>坐标</small><strong>已归一化</strong></span>
          </div>
        </div>
      </section>

      <section className="workflow" id="workflow">
        {stages.map((stage, index) => (
          <div className={index === 0 ? "workflow-item current" : "workflow-item"} key={stage}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{stage}</strong>
          </div>
        ))}
      </section>

      <section className="workspace-grid" id="projects">
        <div className="projects-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">我的项目</p>
              <h2>最近的方案</h2>
            </div>
            <button className="quiet-button" onClick={() => void loadProjects()} type="button">
              刷新
            </button>
          </div>
          {error ? <p className="error-banner">{error}</p> : null}
          {loading ? (
            <div className="empty-state"><span className="spinner" />正在连接项目服务…</div>
          ) : projects.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">⌂</span>
              <strong>还没有项目</strong>
              <p>从右侧填写项目名称，建立第一份自建房方案档案。</p>
            </div>
          ) : (
            <div className="project-list">
              {projects.map((project) => (
                <article className="project-row" key={project.id}>
                  <div className="project-thumb">
                    <span />
                  </div>
                  <div className="project-main">
                    <strong>{project.name}</strong>
                    <p>{project.address || "尚未填写项目地址"}</p>
                  </div>
                  <span className="status-chip">
                    {stageLabel[project.status] ?? project.status}
                  </span>
                  <time>{new Date(project.updatedAt).toLocaleDateString("zh-CN")}</time>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="create-panel" id="new-project">
          <p className="eyebrow">新建项目</p>
          <h2>先建立项目档案</h2>
          <p>项目创建后即可申请上传凭证，并把 DXF 安全保存到对象存储。</p>
          <form onSubmit={createProject}>
            <label>
              项目名称
              <input
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：南溪村张宅"
                required
                value={name}
              />
            </label>
            <label>
              项目地址
              <input
                maxLength={200}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="省 / 市 / 区县 / 村"
                value={address}
              />
            </label>
            <button className="submit-button" disabled={creating} type="submit">
              {creating ? "正在创建…" : "创建并继续"}
            </button>
          </form>
          <div className="scope-note">
            <strong>当前支持</strong>
            <span>标准 ASCII DXF · 单一闭合地块 · 1–3 层独栋</span>
          </div>
        </aside>
      </section>

      <footer>
        <p>筑想家生成内容仅用于前期概念沟通，不可直接用于施工、报建或结构安全判断。</p>
        <span>Day 2 基础能力 · D1 + R2 + DXF</span>
      </footer>
    </main>
  );
}
