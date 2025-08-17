
import React from 'react';

const expertiseAreas = [
  "Product Lifecycle Management", "Agile Methodologies", "Application Design Principles",
  "AI Transformation", "Business Analysis", "Key Performance Indicators",
  "Team Development and Leadership", "Software Architecture", "Relationship Building",
  "Programme Management", "Strategic Planning & Execution",
  "Regulatory Compliance", "Business Use Case and Requirements gathering"
];

const accomplishments = [
  "Developed an Azure based AI solution for extracting engineering information from Legacy data using Machine Learning, VLMs and LLMs.",
  "Deployed innovative tech solutions across 24 of top 25 global energy firms, serving 120k clients, and millions of end-users.",
  "Cut customer operational expenses by 50% and increased productivity by 30% through complex strategic changes.",
  "Maximized cloud computing and AI capabilities to create next-generation collaborative cloud technologies for engineering applications."
];

const CheckIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);


const About: React.FC = () => {
  return (
    <section id="about" className="py-20 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Accomplished Tech-Savvy Professional</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
            With extensive AI experience in directing all facets of Product Management, I integrate business needs and requirements into product planning and operations to deliver cutting-edge solutions aligned with business objectives.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h3 className="text-2xl font-semibold text-gray-800 mb-6">Areas of Expertise</h3>
            <ul className="space-y-4">
              {expertiseAreas.map((item, index) => (
                <li key={index} className="flex items-center">
                  <span className="text-brand-blue font-bold mr-3 text-xl">&#8226;</span>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-gray-800 mb-6">Key Accomplishments</h3>
            <ul className="space-y-5">
              {accomplishments.map((item, index) => (
                <li key={index} className="flex items-start">
                  <CheckIcon />
                  <span className="ml-4 text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
