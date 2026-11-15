'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const socials = [
  ['GitHub', 'https://github.com/raghav3615'],
  ['X / Twitter', 'https://twitter.com/raghav_dadhich'],
  ['LinkedIn', 'https://www.linkedin.com/in/raghavhere/'],
  ['Codeforces', 'https://codeforces.com/profile/ragzus'],
  ['Medium', 'https://medium.com/@itsraghav'],
];

export default function Home() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('ihp-theme');
    const isDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('editor-dark', isDark);
    document.body.classList.toggle('dark', isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('ihp-theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.classList.toggle('editor-dark', next);
    document.body.classList.toggle('dark', next);
  };

  return (
    <main className={dark ? 'landing dark' : 'landing'}>
      {/* Navigation */}
      <nav className="landing-nav">
        <Link href="/" className="landing-brand">
          <b>▥</b> ihate<span>photoshop</span>
        </Link>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
          <a href="#tools">Tools</a>
          <Link href="/canva">Studio</Link>
        </div>
        <div className="nav-actions">
          <button className="theme-toggle" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
            {dark ? '☀' : '◐'}
          </button>
          <Link href="/canva" className="nav-go">
            Open Studio <span>↗</span>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-chip">
          <i></i> Private by default · Runs 100% locally in your browser
        </div>
        <h1>
          Make the image<br />
          <em>you meant to make.</em>
        </h1>
        <p>
          ihatephotoshop is a fast, calm design studio for images, text, shapes, and PDFs.
          All the essentials: typography, filters, layers, and instant multi-format export.
        </p>
        <div className="hero-actions">
          <Link href="/canva" className="hero-go">
            Open Studio <span>↗</span>
          </Link>
          <a href="#features" className="hero-secondary">
            Explore features ↓
          </a>
        </div>

        {/* Interactive Mockup */}
        <div className="hero-canvas">
          <div className="canvas-glow"></div>
          <div className="demo-window">
            <div className="demo-bar">
              <span></span>
              <span></span>
              <span></span>
              <b>untitled-composition.png</b>
            </div>
            <div className="demo-body">
              <aside>
                <i></i>
                <i></i>
                <i></i>
              </aside>
              <div className="demo-art">
                <div className="demo-card one"></div>
                <div className="demo-card two"></div>
                <div className="demo-card three">
                  YOUR<br />
                  NEXT<br />
                  CREATION
                </div>
              </div>
              <div className="demo-inspector">
                <small>SELECTED LAYER</small>
                <b>Typography Layer</b>
                <div></div>
                <label>
                  Font <span>DM Sans</span>
                </label>
                <hr />
                <label>
                  Filters <span>Contrast +120%</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="landing-section">
        <p className="section-kicker">DESIGNED FOR SPEED & CALM</p>
        <h2>
          All the essentials.<br />
          None of the bloat.
        </h2>
        <div className="feature-grid">
          <article>
            <span>01</span>
            <h3>Typography with Web Fonts</h3>
            <p>
              Add headings and body text with 14 curated Google Fonts including Inter, Playfair Display, Bebas Neue, Space Grotesk, and DM Mono.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Photoshop Filters & Adjustments</h3>
            <p>
              Real-time Brightness, Contrast, Saturation, Blur, Invert, Sepia, and Grayscale adjustments rendered with pixel-perfect fidelity.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Vector Shapes & Eyedropper</h3>
            <p>
              Scalable rounded rectangles and circles with custom fills and strokes. Sample any pixel on the canvas using the eyedropper tool.
            </p>
          </article>
          <article>
            <span>04</span>
            <h3>8-Point Transform & Crop Tool</h3>
            <p>
              Interactive 8-point mouse resize handles, rule-of-thirds canvas & image cropping, smooth rotation, alignment, opacity, and Photoshop blend modes.
            </p>
          </article>
          <article>
            <span>05</span>
            <h3>Multi-Canvas Tabs & Presets</h3>
            <p>
              Work on multiple compositions simultaneously. Built-in presets for Instagram, YouTube thumbnails, Twitter headers, presentations, and A4.
            </p>
          </article>
          <article>
            <span>06</span>
            <h3>Export Anywhere in Seconds</h3>
            <p>
              Download crisp transparent PNGs, optimized JPGs, next-gen WebP, or printable PDFs. Or copy straight to your clipboard with one click.
            </p>
          </article>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="landing-section workflow">
        <div>
          <p className="section-kicker">A BETTER DEFAULT</p>
          <h2>
            From blank page<br />
            to export in seconds.
          </h2>
        </div>
        <ol>
          <li>
            <b>01</b>
            <div>
              <h3>Choose a starting point</h3>
              <p>Start with a blank canvas in any color, transparent background, or drop in images and PDF files.</p>
            </div>
          </li>
          <li>
            <b>02</b>
            <div>
              <h3>Craft your composition</h3>
              <p>Add text, style fonts, draw vector shapes, apply photo filters, resize with drag handles, and arrange layers.</p>
            </div>
          </li>
          <li>
            <b>03</b>
            <div>
              <h3>Export in the exact format you need</h3>
              <p>Download as PNG, JPG, WebP, PDF, or copy directly to your clipboard to paste into Slack, Figma, or Twitter.</p>
            </div>
          </li>
        </ol>
      </section>

      {/* Toolbox Strip */}
      <section id="tools" className="landing-section tool-strip">
        <p className="section-kicker">THE TOOLBOX</p>
        <h2>
          Just enough Photoshop<br />
          to get it done.
        </h2>
        <div className="tool-pills">
          <span>Multi-canvas Tabs</span>
          <span>Rich Web Fonts</span>
          <span>Image Adjustments</span>
          <span>Vector Shapes</span>
          <span>Eyedropper Tool</span>
          <span>Corner Resize Handles</span>
          <span>Aspect Ratio Lock</span>
          <span>Rotation & Flip</span>
          <span>Photoshop Blend Modes</span>
          <span>Layer Visibility & Lock</span>
          <span>Transparent Canvas</span>
          <span>PNG / JPG / WebP / PDF</span>
          <span>Copy to Clipboard</span>
          <span>Dark & Light Themes</span>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-cta">
        <p>YOUR NEXT BLANK CANVAS</p>
        <h2>
          Less waiting.<br />
          <em>More making.</em>
        </h2>
        <Link href="/canva">
          Launch ihatephotoshop <span>↗</span>
        </Link>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div>
          <Link href="/" className="landing-brand">
            <b>▥</b> ihate<span>photoshop</span>
          </Link>
          <p>Built for the ideas that deserve a little more room. No account, no cloud storage, no subscriptions.</p>
        </div>
        <div className="footer-links">
          <p>CREATOR</p>
          {socials.map(([name, url]) => (
            <a key={name} href={url} target="_blank" rel="noreferrer">
              {name} ↗
            </a>
          ))}
        </div>
        <small>© 2026 Raghav Dadhich. Private by default. Built for the modern web.</small>
      </footer>
    </main>
  );
}
