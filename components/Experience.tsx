
import React from 'react';
import type { ExperienceItem } from '../types';

const experienceData: ExperienceItem[] = [
  {
    role: "Director of Product Management",
    company: "Kinsmen Group, UK based",
    period: "Jun 2023 - Present",
    description: "Collaborated with business and customers on product requirements. Worked with an offshore development team to develop an industrial-scale engineering data extraction and review solution built around Azure AI technologies. Sold to large energy, utilities, and pharma companies."
  },
  {
    role: "Director of Product Management, Energy & Engineering Solutions",
    company: "OpenText, Reading, UK (aquired EMC's Documentum division)",
    period: "Feb 2012 - Jun 2023",
    description: "Led the product team creating innovative engineering business solutions. Produced more than $100M in industry-related income. Generated multimillion-dollar agreements and increased productivity while reducing customer costs by 50%."
  },
  {
    role: "Head of Professional Services EMEA",
    company: "Sword CTSpace, London, UK",
    period: "Jan 2011 - Feb 2012",
    description: "Supervised successful delivery of consulting services through effective customer engagements. Boosted revenue 30% by overseeing professional services team's growth and reduced time-to-value for consumers by 20%."
  },
  {
    role: "Principal Consultant, EMC, London, UK.  ",
    company: "EMC (Documentum Division)",
    period: "2006 to 2011",
    description: "Strategic Consulting on Information Management Roadmaps for Fortune 500 companies companies.  Lead Consultant on large scale implementations of the Documentum ECM system with extensions for Engineering.in the Energy, Utilities and Construction Industries."
  },
  {
    role: "Founder & CEO",
    company: "Jario Ltd",
    period: "2004 to 2006",
    description: "Government funded startup to track document content within and across organizations"
  },
   {
    role: "Co-Founder & CTO",
    company: "DataCAD, CADspace, McLaren (series of acquisitions)",
    period: "1995 to 2004",
    description: "Developed Documentum-based engineering add-on solutions"
  },
  {
    role: "Senior Consultant",
    company: "Intergraph (UK)",
    period: "1990 to 1995",
    description: "Focussing primarily on Plant Design and Information Management solutions for Oil & Gas"
  }
];


const ExperienceCard: React.FC<{ item: ExperienceItem }> = ({ item }) => (
    <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-200">
        <div className="flex justify-between items-baseline mb-2">
            <h3 className="text-xl font-bold text-brand-blue">{item.role}</h3>
            <p className="text-sm font-medium text-gray-500">{item.period}</p>
        </div>
        <p className="text-md font-semibold text-gray-700 mb-4">{item.company}</p>
        <p className="text-gray-600 leading-relaxed">{item.description}</p>
    </div>
);


const Experience: React.FC = () => {
  return (
    <section id="experience" className="py-20 scroll-mt-20 bg-brand-light">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Career Experience</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
            A proven track record of creating ground-breaking products and converting on-premise solutions to the cloud.
          </p>
        </div>
        <div className="max-w-4xl mx-auto">
          <div className="space-y-8">
            {experienceData.map((item, index) => (
              <ExperienceCard key={index} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Experience;
