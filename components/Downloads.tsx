// components/Downloads.tsx
import React from 'react';

const DownloadIcon: React.FC<{ className?: string }> = ({ className = 'h-6 w-6' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"               // 24px grid = crisper scaling
    fill="currentColor"               // inherits button text color
    aria-hidden="true"
    className={`flex-shrink-0 ${className}`}
  >
    <path
      fillRule="evenodd"
      d="M5 20a1 1 0 0 1-1-1v-3a1 1 0 1 1 2 0v2h12v-2a1 1 0 1 1 2 0v3a1 1 0 0 1-1 1H5zm6.293-5.707a1 1 0 0 0 1.414 0l3-3a1 1 0 1 0-1.414-1.414L13 11.586V4a1 1 0 1 0-2 0v7.586l-1.293-1.293a1 1 0 0 0-1.414 1.414l3 3z"
      clipRule="evenodd"
    />
  </svg>
);

const Downloads: React.FC = () => {
  return (
    <section id="downloads" className="py-20 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Resources &amp; Downloads</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
            Download background and other relevant documents.
          </p>
        </div>

        <div className="max-w-2xl mx-auto bg-gray-50 p-8 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-lg text-gray-800 mb-4">Note for Site Owner:</h3>
          <p className="text-gray-600 mb-6">
            Put downloadable files in <code>/public/assets/</code>, then link to them like <code>/assets/filename.pdf</code>.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <a
              href="/assets/Chris-Brighouse CV P.pdf"
              download
              className="group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg
                         bg-blue-600 px-5 py-3 text-white font-semibold shadow
                         hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <DownloadIcon className="h-6 w-6 transition-transform group-hover:translate-y-0.5" />
              Download CV (PDF)
            </a>

            <a
              href="/assets/Chris_Consulting_Services_SinglePage.pdf"
              download
              className="group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg
                         bg-gray-800 px-5 py-3 text-slate-100 font-semibold shadow
                         hover:bg-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-800"
            >
              <DownloadIcon className="h-6 w-6 transition-transform group-hover:translate-y-0.5" />
              Services Overview (PDF)
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Downloads;
