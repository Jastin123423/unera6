import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEye,
  faMousePointer,
  faPlay,
  faPause,
  faTrash,
  faExternalLinkAlt,
  faEllipsisV,
  faCalendar,
  faDollarSign,
  faChartLine,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { AdCampaign } from '../types';

interface AdsManagerProps {
  campaigns: AdCampaign[];
  onUpdate: () => void;
  onPause: (id: number) => Promise<boolean>;
  onResume: (id: number) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
}

export default function AdsManager({ campaigns, onUpdate, onPause, onResume, onDelete }: AdsManagerProps) {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'completed'>('all');

  const filteredCampaigns = campaigns.filter(ad => {
    if (filter === 'all') return true;
    return ad.status === filter;
  });

  const handleToggle = async (ad: AdCampaign) => {
    setLoadingId(ad.id);
    const success = ad.status === 'active' 
      ? await onPause(ad.id)
      : await onResume(ad.id);
    
    if (success) {
      onUpdate();
    }
    setLoadingId(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    
    setLoadingId(id);
    const success = await onDelete(id);
    if (success) {
      onUpdate();
    }
    setLoadingId(null);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const calculateCTR = (ad: AdCampaign) => {
    if (ad.analytics.impressions === 0) return '0.0';
    return ((ad.analytics.clicks / ad.analytics.impressions) * 100).toFixed(1);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-500';
      case 'paused': return 'bg-amber-500/10 text-amber-500';
      case 'completed': return 'bg-zinc-500/10 text-zinc-500';
      default: return 'bg-zinc-500/10 text-zinc-500';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">My Campaigns</h2>
          <p className="text-zinc-400 mt-1">Manage and track your active advertisement campaigns.</p>
        </div>
        <div className="flex gap-2">
          <select 
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-700"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Campaign</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest text-center">Impressions</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest text-center">Clicks</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest text-center">CTR</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest text-center">Spent</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredCampaigns.map((ad) => (
                <tr key={ad.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-700">
                        {ad.mediaUrl ? (
                          <img src={ad.mediaUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-600 to-emerald-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{ad.name}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <FontAwesomeIcon icon={faCalendar} className="w-3 h-3" />
                          <span>{formatDate(ad.start_date)} - {formatDate(ad.end_date)}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ad.status)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        ad.status === 'active' ? 'bg-emerald-500 animate-pulse' : 
                        ad.status === 'paused' ? 'bg-amber-500' : 'bg-zinc-500'
                      }`} />
                      {ad.status.charAt(0).toUpperCase() + ad.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <p className="text-sm font-medium text-white">{ad.analytics.impressions.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <p className="text-sm font-medium text-white">{ad.analytics.clicks.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <p className="text-sm font-bold text-emerald-500">{calculateCTR(ad)}%</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <p className="text-sm font-medium text-white">${ad.analytics.spend.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleToggle(ad)}
                        disabled={loadingId === ad.id || ad.status === 'completed'}
                        className={`p-2 rounded-lg transition-colors ${
                          ad.status === 'active' 
                            ? 'hover:bg-amber-500/10 text-amber-500' 
                            : 'hover:bg-emerald-500/10 text-emerald-500'
                        } ${(loadingId === ad.id || ad.status === 'completed') ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={ad.status === 'active' ? 'Pause' : 'Resume'}
                      >
                        {loadingId === ad.id ? (
                          <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />
                        ) : ad.status === 'active' ? (
                          <FontAwesomeIcon icon={faPause} className="w-4 h-4" />
                        ) : (
                          <FontAwesomeIcon icon={faPlay} className="w-4 h-4" />
                        )}
                      </button>
                      <button 
                        onClick={() => handleDelete(ad.id)}
                        disabled={loadingId === ad.id}
                        className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredCampaigns.map((ad) => (
          <div key={ad.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden border border-zinc-700">
                  {ad.mediaUrl ? (
                    <img src={ad.mediaUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-600 to-emerald-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-white truncate max-w-[150px]">{ad.name}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(ad.status)}`}>
                    {ad.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleToggle(ad)}
                  disabled={loadingId === ad.id || ad.status === 'completed'}
                  className={`p-2 bg-zinc-800 rounded-lg ${
                    ad.status === 'active' ? 'text-amber-500' : 'text-emerald-500'
                  }`}
                >
                  {loadingId === ad.id ? (
                    <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />
                  ) : ad.status === 'active' ? (
                    <FontAwesomeIcon icon={faPause} className="w-4 h-4" />
                  ) : (
                    <FontAwesomeIcon icon={faPlay} className="w-4 h-4" />
                  )}
                </button>
                <button 
                  onClick={() => handleDelete(ad.id)}
                  disabled={loadingId === ad.id}
                  className="p-2 bg-zinc-800 rounded-lg text-zinc-400"
                >
                  <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2 pt-4 border-t border-zinc-800">
              <div className="text-center">
                <FontAwesomeIcon icon={faEye} className="w-4 h-4 mx-auto mb-1 text-zinc-500" />
                <p className="text-xs font-bold text-white">{ad.analytics.impressions.toLocaleString()}</p>
                <p className="text-[10px] text-zinc-500">Impr.</p>
              </div>
              <div className="text-center">
                <FontAwesomeIcon icon={faMousePointer} className="w-4 h-4 mx-auto mb-1 text-zinc-500" />
                <p className="text-xs font-bold text-white">{ad.analytics.clicks.toLocaleString()}</p>
                <p className="text-[10px] text-zinc-500">Clicks</p>
              </div>
              <div className="text-center">
                <FontAwesomeIcon icon={faChartLine} className="w-4 h-4 mx-auto mb-1 text-zinc-500" />
                <p className="text-xs font-bold text-emerald-500">{calculateCTR(ad)}%</p>
                <p className="text-[10px] text-zinc-500">CTR</p>
              </div>
              <div className="text-center">
                <FontAwesomeIcon icon={faDollarSign} className="w-4 h-4 mx-auto mb-1 text-zinc-500" />
                <p className="text-xs font-bold text-white">${ad.analytics.spend}</p>
                <p className="text-[10px] text-zinc-500">Spent</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800">
              <div className="flex items-center gap-1">
                <FontAwesomeIcon icon={faCalendar} className="w-3 h-3" />
                <span>{formatDate(ad.start_date)}</span>
              </div>
              <div className="flex items-center gap-1">
                <FontAwesomeIcon icon={faDollarSign} className="w-3 h-3" />
                <span>${ad.budget}/day</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCampaigns.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl py-20 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center">
              <FontAwesomeIcon icon={faChartLine} className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="text-zinc-500 font-medium">No campaigns found</p>
            <p className="text-zinc-600 text-sm">Create your first ad to see analytics here.</p>
          </div>
        </div>
      )}
    </div>
  );
}
