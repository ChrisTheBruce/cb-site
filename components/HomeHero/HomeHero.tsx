import React from 'react';
import styles from './HomeHero.module.css';

export default function HomeHero() {
  return (
    <section className={styles.hero}>
      <div className={`${styles.inner} mx-auto max-w-6xl px-4 py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center`}>
        <div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
            Product Management & AI Transformation for{" "}
            <span className="text-blue-300">
              Engineering Projects and Operations
            </span>
          </h1>
          <p className="mt-5 text-lg text-slate-100 leading-relaxed">
            I define product strategy and help to build innovative, AI-led
            solutions for the Energy, Utilities and Engineering Construction
            industries.
          </p>
          <div className="mt-8 flex gap-3">
            <a
              href="#contact"
              className="inline-flex items-center px-5 py-3 rounded-lg border font-medium text-white border-white/60 hover:bg-white/10"
            >
              Let’s talk
            </a>
            <a
              href="#work"
              className="inline-flex items-center px-5 py-3 rounded-lg border font-medium text-white border-white/60 hover:bg-white/10"
            >
              See work
            </a>
          </div>
        </div>

        <div className="md:justify-self-end">
          <div className="aspect-video rounded-xl border border-white/30 bg-white/5 backdrop-blur-sm shadow-sm p-5">
            <ul className="grid grid-cols-2 gap-3 text-sm text-white">
              <li className="rounded border border-white/30 p-3">
                AI Transformation
              </li>
              <li className="rounded border border-white/30 p-3">
                Product Management
              </li>
              <li className="rounded border border-white/30 p-3">
                Strategic Consulting
              </li>
              <li className="rounded border border-white/30 p-3">
                Product Strategy
              </li>
            </ul>
            <p className="mt-6 text-lg font-semibold text-indigo-200 text-center">
              Experience, Innovation and Drive
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
