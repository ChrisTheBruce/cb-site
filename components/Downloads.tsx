// Downloads.tsx  (only the buttons block shown)
<div className="not-prose mt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
  <a
    href="/assets/Chris-Brighouse-CV.pdf"
    download
    className="group inline-flex w-full sm:w-auto items-center justify-center gap-2
               rounded-lg bg-blue-600 px-5 py-3 text-white font-semibold shadow
               hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"           // ← inherit button text color
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 flex-shrink-0"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
    Download CV (PDF)
  </a>

  <a
    href="/assets/Chris_Consulting_Services_SinglePage.pdf"
    download
    className="group inline-flex w-full sm:w-auto items-center justify-center gap-2
               rounded-lg bg-slate-900 px-5 py-3 text-slate-100 font-semibold shadow
               hover:bg-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 flex-shrink-0"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
    Services Overview (PDF)
  </a>
</div>
