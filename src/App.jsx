import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Header from './components/Header';
import ReportForm from './components/ReportForm';
import PublicTracker from './components/PublicTracker';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import Footer from './components/Footer';
import { getSupabase } from './lib/supabase';

function App() {
  // หน้าแรกเป็นหน้าสถิติ/ติดตามปัญหา
  const [activeTab, setActiveTab] = useState('tracker'); 
  const [session, setSession] = useState(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
      setSession(null);
      setActiveTab('tracker'); 
    }
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        session={session}
        onLogout={handleLogout}
      />
      
      <div className="page-wrapper">
        <div className={`main-card ${activeTab === 'tracker' ? 'full-width-card' : (activeTab === 'admin' && session) ? 'wide-card' : ''}`}>
          <Header activeTab={activeTab} />
          
          <div className="card-body">
            {activeTab === 'report' && <ReportForm />}
            {activeTab === 'tracker' && <PublicTracker />}
            {activeTab === 'admin' && (
              session ? (
                <AdminDashboard />
              ) : (
                <AdminLogin onLoginSuccess={(s) => setSession(s)} />
              )
            )}
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}

export default App;