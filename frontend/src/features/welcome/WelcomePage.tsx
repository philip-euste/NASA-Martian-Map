// frontend\src\features\welcome\WelcomePage.tsx
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Map as MapIcon,
  Orbit,
  Telescope,
} from "lucide-react";
import AppLayout from "../../components/layout/AppLayout";
import { MAP_LAYERS } from "../../data/mapLayers";
import { WORKFLOW_STEPS } from "../mission/workflow";
import './WelcomePage.css';

const FEATURES = [
  { icon: Orbit, title: "NASA data", text: "Grounded in real missions" },
  { icon: MapIcon, title: "Interactive maps", text: "Find your next discovery" },
  { icon: Telescope, title: "Scientific discovery", text: "Explore a planet of possibility" },
];

export default function WelcomePage() {
  const { hash } = useLocation();

  // Support header links such as "/#about".
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  return (
    <AppLayout>
        <main>
          <div className="planetary-background">
            {/* Welcome Section */}
            <section className="welcome-container">

                <p className="sectionlabel">A world waiting to be explored</p>

                <div className="Title">
                    <h1>Explore<br />Mars</h1>
                </div>

                <div className="introduction">
                    <p>
                        A world beyond our own. Journey across ancient
                        craters, discover extraordinary terrain, and
                        see Mars from a new perspective.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <Link
                        className="buttonstarting mx-btn mx-btn--primary"
                        to="/explorer"
                    >
                        Start Exploration
                        <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                    <Link
                        className="mx-btn mx-btn--secondary"
                        to="/mission"
                    >
                        Mission Workspace
                    </Link>
                    <Link
                        className="mx-btn mx-btn--secondary"
                        to="/mission/simulate"
                    >
                        Marswalk 3D EVA
                    </Link>
                    <a className="mx-btn mx-btn--secondary" href="#about">
                        Learn More
                    </a>
                </div>

            </section>

            <div className="planet-caption" aria-hidden="true">
                <span className="mx-eyebrow">The red planet</span>
                <span className="mx-mono text-mx-text">225 million km from home</span>
            </div>
          </div>

          {/* Feature highlights (Figma landing footer strip) */}
          <section className="border-y border-mx-border" aria-label="Highlights">
            <div className="mx-auto grid max-w-[1440px] gap-6 px-5 py-8 sm:grid-cols-3 sm:px-8 lg:px-14">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex items-start gap-4">
                  <Icon size={22} strokeWidth={1.5} className="mt-0.5 text-mx-muted" aria-hidden="true" />
                  <div>
                    <p className="m-0 text-sm font-semibold text-mx-text">{title}</p>
                    <p className="m-0 mt-1 text-xs text-mx-muted">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Exploration overview */}
          <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-14" aria-labelledby="workflow-title">
            <p className="mx-eyebrow mx-eyebrow--accent mb-3">How an expedition works</p>
            <h2 id="workflow-title" className="mx-display m-0 max-w-2xl text-4xl uppercase sm:text-5xl">
              From orbit to field report
            </h2>
            <p className="mx-body mt-4 max-w-xl">
              Mars Explorer follows the path of a real scientific investigation —
              each stage builds on the shared mission record.
            </p>

            <ol className="mt-12 grid list-none gap-px overflow-hidden rounded-[10px] border border-mx-border bg-mx-border p-0 sm:grid-cols-2 lg:grid-cols-5">
              {WORKFLOW_STEPS.map((step, index) => (
                <li key={step.id} className="flex flex-col bg-mx-bg p-6 sm:last:col-span-2 lg:last:col-span-1">
                  <span className="mx-mono text-mx-dim">{String(index + 1).padStart(2, "0")}</span>
                  <span className="mt-4 font-display text-lg font-semibold uppercase tracking-wide text-mx-text">
                    {step.stage}
                  </span>
                  <span className="mx-body mt-2 flex-1 text-[13px]">{step.summary}</span>
                  {step.path ? (
                    <Link to={step.path} className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-mx-accent no-underline hover:underline">
                      {step.label} <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="mt-5 text-[13px] text-mx-dim">{step.label} · In development</span>
                  )}
                </li>
              ))}
            </ol>
          </section>

          {/* About */}
          <section id="about" className="scroll-mt-20 border-t border-mx-border">
            <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:px-14">
              <div>
                <p className="mx-eyebrow mb-3">About the platform</p>
                <h2 className="mx-display m-0 text-3xl uppercase sm:text-4xl">
                  A scientific exploration workspace
                </h2>
                <p className="mx-body mt-5 max-w-lg">
                  Mars Explorer combines public NASA planetary datasets with a
                  shared mission record so you can move from browsing the planet
                  to framing a question, weighing the evidence, planning a
                  traverse and documenting what remains unknown.
                </p>
                <Link to="/explorer" className="mx-btn mx-btn--primary mt-8">
                  Open the explorer <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <dl className="m-0 grid content-start gap-px overflow-hidden rounded-[10px] border border-mx-border bg-mx-border sm:grid-cols-2">
                <div className="bg-mx-bg p-6">
                  <dt className="mx-field__label">Map layers</dt>
                  <dd className="m-0 mt-2 font-display text-3xl font-semibold text-mx-text">
                    {Object.keys(MAP_LAYERS).length}
                  </dd>
                  <dd className="m-0 mt-1 text-xs text-mx-muted">Global NASA Mars Trek WMTS products</dd>
                </div>
                <div className="bg-mx-bg p-6">
                  <dt className="mx-field__label">Elevation source</dt>
                  <dd className="m-0 mt-2 font-display text-xl font-semibold text-mx-text">HiRISE DTM</dd>
                  <dd className="m-0 mt-1 text-xs text-mx-muted">Jezero mosaic via the terrain API</dd>
                </div>
                <div className="bg-mx-bg p-6 sm:col-span-2">
                  <dt className="mx-field__label">Instruments represented</dt>
                  <dd className="m-0 mt-2 text-sm text-mx-text">
                    MGS MOLA · Viking · MGS MOC · MGS TES · Mars Odyssey THEMIS · MRO HiRISE
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </main>
    </AppLayout>
  );
}
