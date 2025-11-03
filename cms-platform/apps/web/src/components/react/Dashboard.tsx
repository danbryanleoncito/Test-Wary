import { useState, useEffect } from 'react';
import type { DashboardMetrics } from '@repo/shared';

interface DashboardProps {
  apiUrl: string;
}

export default function Dashboard({ apiUrl }: DashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [liveVisitors, setLiveVisitors] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Connect to SSE for real-time updates
    const eventSource = new EventSource(`${apiUrl}/api/realtime`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          console.log('Real-time connection established');
        } else if (data.type === 'analytics_update') {
          setMetrics(data.data);
          setLiveVisitors(data.data.liveVisitors);
        }
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      eventSource.close();
    };

    // Fetch initial metrics
    fetchMetrics();

    return () => {
      eventSource.close();
    };
  }, [apiUrl]);

  const fetchMetrics = async () => {
    try {
      // Mock data for demonstration
      const mockMetrics: DashboardMetrics = {
        totalArticles: 45,
        publishedArticles: 32,
        draftArticles: 13,
        totalViews: 12543,
        totalComments: 287,
        liveVisitors: 5,
        viewsToday: 342,
        popularArticles: [
          { id: '1', title: 'Getting Started with React', views: 1523 },
          { id: '2', title: 'Advanced TypeScript Patterns', views: 1234 },
          { id: '3', title: 'Building with Astro.js', views: 987 },
        ],
      };

      setMetrics(mockMetrics);
      setLiveVisitors(mockMetrics.liveVisitors);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  if (!metrics) {
    return <div className="dashboard-error">Failed to load dashboard metrics</div>;
  }

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <h3>Total Articles</h3>
            <p className="metric-value">{metrics.totalArticles}</p>
            <p className="metric-detail">
              {metrics.publishedArticles} published, {metrics.draftArticles} drafts
            </p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">👁️</div>
          <div className="metric-content">
            <h3>Total Views</h3>
            <p className="metric-value">{metrics.totalViews.toLocaleString()}</p>
            <p className="metric-detail">{metrics.viewsToday} today</p>
          </div>
        </div>

        <div className="metric-card live">
          <div className="metric-icon">🟢</div>
          <div className="metric-content">
            <h3>Live Visitors</h3>
            <p className="metric-value">{liveVisitors}</p>
            <p className="metric-detail">Right now</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">💬</div>
          <div className="metric-content">
            <h3>Comments</h3>
            <p className="metric-value">{metrics.totalComments}</p>
            <p className="metric-detail">All time</p>
          </div>
        </div>
      </div>

      <div className="popular-articles">
        <h2>Popular Articles</h2>
        <div className="articles-list">
          {metrics.popularArticles.map((article) => (
            <div key={article.id} className="popular-article">
              <div className="article-info">
                <h3>{article.title}</h3>
                <p className="views">{article.views.toLocaleString()} views</p>
              </div>
              <div className="article-chart">
                <div
                  className="chart-bar"
                  style={{
                    width: `${(article.views / metrics.popularArticles[0].views) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
