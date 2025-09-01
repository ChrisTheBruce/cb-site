import React from 'react';

const Contact: React.FC = () => {
    const contactInfo = [
        { 
            label: 'LinkedIn', 
            value: 'linkedin.com/in/chrisbrighouse', 
            href: 'https://www.linkedin.com/in/chrisbrighouse',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z"/>
                </svg>
            ) 
        },
        { 
            label: 'Email', 
            value: 'chris.brighouse@hotmail.co.uk', 
            href: 'mailto:chris.brighouse@hotmail.co.uk',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
            ) 
        },
        { 
            label: 'Phone', 
            value: '+44 (0)7354 944156', 
            href: 'tel:+447354944156',
            icon: (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
            )
        },
    ];

  return (
    <section id="contact" className="py-20 bg-brand-light">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Let's Connect</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
            Ready to drive innovation and transformation? Reach out to discuss your next project.
          </p>
        </div>
        
        <div className="max-w-lg mx-auto bg-white p-8 rounded-lg shadow-lg">
            <div className="space-y-6">
                {contactInfo.map(info => (
                    <a href={info.href} key={info.label} target="_blank" rel="noopener noreferrer" className="flex items-center p-3 rounded-md hover:bg-gray-100 transition-colors duration-200 group">
                       <span className="text-brand-blue">{info.icon}</span>
                        <div className="ml-4">
                            <p className="font-semibold text-gray-800">{info.label}</p>
                            <p className="text-gray-600 group-hover:text-brand-blue transition-colors duration-200">{info.value}</p>
                        </div>
                    </a>
                ))}
            </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;