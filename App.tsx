
import React from 'react';
import FactBrowser from './components/FactBrowser';
import { awxConfig, dbConfig } from './config';

const App: React.FC = () => {
  return (
    <div className="h-screen font-sans flex flex-col">
      <FactBrowser awxConfig={awxConfig} dbConfig={dbConfig} />
    </div>
  );
};

export default App;
