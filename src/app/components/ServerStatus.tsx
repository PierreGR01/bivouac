import React, { useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import * as api from '/utils/supabase/api';

export function ServerStatus() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [responseDetails, setResponseDetails] = useState<string>('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'confirming' | 'resetting' | 'success' | 'error'>('idle');
  const [resetMessage, setResetMessage] = useState<string>('');

  const checkServerHealth = async () => {
    setStatus('checking');
    setErrorMessage('');
    setResponseDetails('');

    const url = `https://${projectId}.supabase.co/functions/v1/make-server-e51cba93/health`;
    
    try {
      console.log('Testing server at:', url);
      console.log('Using Authorization:', `Bearer ${publicAnonKey.substring(0, 20)}...`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      setResponseDetails(`Status: ${response.status} ${response.statusText}\nBody: ${responseText}`);

      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          console.log('Response data:', data);
          setStatus('success');
        } catch (e) {
          setStatus('success');
        }
      } else {
        console.error('Error response:', responseText);
        setErrorMessage(`HTTP ${response.status}: ${response.statusText}`);
        setStatus('error');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setResponseDetails(`Exception: ${error instanceof Error ? error.stack : String(error)}`);
      setStatus('error');
    }
  };

  const handleResetDatabase = async () => {
    if (resetStatus === 'confirming') {
      setResetStatus('resetting');
      setResetMessage('');
      
      try {
        const result = await api.resetPois();
        
        if (result.success) {
          setResetStatus('success');
          setResetMessage(`Base de données réinitialisée avec succès ! ${result.deletedCount || 0} POI(s) supprimé(s).`);
          // Recharger la page après 2 secondes
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          setResetStatus('error');
          setResetMessage('Échec de la réinitialisation de la base de données.');
        }
      } catch (error) {
        console.error('Error resetting database:', error);
        setResetStatus('error');
        setResetMessage(error instanceof Error ? error.message : String(error));
      }
    } else {
      setResetStatus('confirming');
    }
  };

  const handleCancelReset = () => {
    setResetStatus('idle');
    setResetMessage('');
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl">
      <h2 className="text-xl font-bold mb-4 text-gray-900">Diagnostic du serveur</h2>
      
      <div className="space-y-3 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-sm font-medium text-gray-600 w-32">Project ID:</span>
          <span className="text-sm text-gray-900 font-mono break-all">{projectId}</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-sm font-medium text-gray-600 w-32">Server URL:</span>
          <span className="text-sm text-gray-900 font-mono break-all">
            https://{projectId}.supabase.co/functions/v1/make-server-e51cba93
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-sm font-medium text-gray-600 w-32">Health Check:</span>
          <span className="text-sm text-gray-900 font-mono break-all">
            https://{projectId}.supabase.co/functions/v1/make-server-e51cba93/health
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={checkServerHealth}
          disabled={status === 'checking'}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'checking' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Vérification en cours...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Tester la connexion
            </>
          )}
        </button>

        {resetStatus === 'confirming' ? (
          <>
            <button
              onClick={handleResetDatabase}
              disabled={resetStatus === 'resetting'}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {resetStatus === 'resetting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Confirmer la suppression
                </>
              )}
            </button>
            <button
              onClick={handleCancelReset}
              disabled={resetStatus === 'resetting'}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Annuler
            </button>
          </>
        ) : (
          <button
            onClick={handleResetDatabase}
            disabled={resetStatus === 'resetting'}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Réinitialiser la base de données
          </button>
        )}
      </div>

      {status === 'success' && (
        <div className="mt-4 p-4 bg-green-50 border-l-4 border-green-400 rounded-r-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              Le serveur est accessible et fonctionne correctement !
            </p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
          <div className="flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 mb-2">
                Impossible de se connecter au serveur
              </p>
              <p className="text-xs text-red-700 font-mono whitespace-pre-wrap break-all mb-3">
                {errorMessage}
              </p>
              {responseDetails && (
                <div className="mb-3 p-2 bg-red-100 rounded text-xs font-mono whitespace-pre-wrap break-all text-red-800">
                  {responseDetails}
                </div>
              )}
              <div className="mt-3 text-xs text-red-700">
                <p className="font-medium mb-1">Solutions possibles :</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Dans Figma Make, les Edge Functions se déploient automatiquement (peut prendre 1-2 min)</li>
                  <li>Vérifiez les logs dans le Dashboard Supabase → Edge Functions</li>
                  <li>Assurez-vous que SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont configurés</li>
                  <li>Si l'erreur persiste, rechargez la page dans quelques instants</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {resetStatus === 'success' && (
        <div className="mt-4 p-4 bg-green-50 border-l-4 border-green-400 rounded-r-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              {resetMessage}
            </p>
          </div>
        </div>
      )}

      {resetStatus === 'error' && (
        <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
          <div className="flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 mb-2">
                Erreur lors de la réinitialisation
              </p>
              <p className="text-xs text-red-700 font-mono whitespace-pre-wrap break-all">
                {resetMessage}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
