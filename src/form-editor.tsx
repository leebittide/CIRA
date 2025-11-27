import React from 'react';
import ReactDOM from 'react-dom/client';
import FormEditor from './components/dashboard/FormEditor';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-gray-100 p-8">
      <FormEditor />
    </div>
  </React.StrictMode>,
);
