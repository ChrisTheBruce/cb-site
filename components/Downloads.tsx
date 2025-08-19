// components/Downloads.tsx
import React from 'react';

function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"            // inherits the button text color
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

export default function Downloads() {
  return (
    <section id="downloads" className="py-20 scroll-mt-20 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            Resources &amp; Downloads
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
            Download my CV and other relevant documents.
          </p>
        </div>

        <div className="max-w-2xl mx-auto bg-gray-50 p-8 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-lg text-gray-800 mb-4">
            Click on an item to download it:
          </h3>
          <p className="text-gray-600">
          </p>

          {/* Buttons */}
          <div className="not-prose mt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
            <a
              href="/assets/Chris-Brighouse-CV.pdf"
              download
              className="inline-flex items-center px-5 py-3 rounded-lg border font-medium hover:bg-slate-50"
            >
              <DownloadIcon className="h-5 w-5 flex-shrink-0" />
              Download CV (PDF)
            </a>

            <a
              href="/assets/Chris_Consulting_Services_SinglePage.pdf"
              download
              className="inline-flex items-center px-5 py-3 rounded-lg border font-medium hover:bg-slate-50"
            >
              <DownloadIcon className="h-5 w-5 flex-shrink-0" />
              Services Overview (PDF)
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
