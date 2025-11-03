import { useState, useEffect } from 'react';
import type { Comment } from '@repo/shared';

interface CommentsProps {
  articleId: string;
  apiUrl: string;
}

export default function Comments({ articleId, apiUrl }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // In a real implementation, fetch comments from API
    // For now, we'll use mock data
    setTimeout(() => {
      setComments([]);
      setLoading(false);
    }, 500);
  }, [articleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newComment.trim()) return;

    setSubmitting(true);

    try {
      // In a real implementation, submit to API
      // const response = await fetch(`${apiUrl}/api/comments`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ articleId, text: newComment })
      // });

      // Mock: Add comment optimistically
      const mockComment: Comment = {
        id: Date.now().toString(),
        text: newComment,
        author: {
          id: '1',
          name: 'You',
          email: 'user@example.com',
          role: 'viewer',
          avatar: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        authorId: '1',
        articleId,
        replies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        reactions: [],
        isModerated: false,
      };

      setComments([mockComment, ...comments]);
      setNewComment('');
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="comments-loading">
        <p>Loading comments...</p>
      </div>
    );
  }

  return (
    <div className="comments">
      <h2>Comments ({comments.length})</h2>

      <form onSubmit={handleSubmit} className="comment-form">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your thoughts..."
          rows={4}
          disabled={submitting}
        />
        <button type="submit" disabled={submitting || !newComment.trim()}>
          {submitting ? 'Posting...' : 'Post Comment'}
        </button>
      </form>

      <div className="comments-list">
        {comments.length === 0 ? (
          <p className="no-comments">No comments yet. Be the first to comment!</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="comment">
              <div className="comment-header">
                <span className="comment-author">{comment.author.name}</span>
                <span className="comment-date">
                  {new Date(comment.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="comment-text">{comment.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
