// components/Downloads.tsx
import React from 'react'

const DownloadIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
)

const Downloads: React.FC = () => {
  return (
    <section id="downloads" className="py-20 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Resources &amp; Downloads</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
            Download my CV and other relevant documents.
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
              className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition-all duration-300 shadow"
            >
              <DownloadIcon />
              Download CV (PDF)
            </a>

            <a
              href="/assets/Chris_Consulting_Services_SinglePage.pdf"
              download
              className="w-full sm:w-auto flex items-center justify-center bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-700 transition-all duration-300 shadow"
            >
              <DownloadIcon />
              Services Overview (PDF)
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Downloads
