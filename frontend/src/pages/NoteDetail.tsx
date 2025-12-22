import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { DOC_URL, VER_URL, COM_URL } from '../services/api';
import { Download, MessageCircle, Clock, File, Upload as UploadIcon } from 'lucide-react';

interface Document {
    id: number;
    title: string;
    description: string;
    created_at: string;
}

interface Version {
    id: number;
    version_number: number;
    file_name: string;
    created_at: string;
    download_url: string;
}

interface Comment {
    id: number;
    username: string;
    content: string;
    created_at: string;
}

const FilePreview = ({ url, filename }: { url: string, filename: string }) => {
    const ext = filename?.split('.').pop()?.toLowerCase() || '';
    // Ensure absolute URL for external viewers (like Google Docs)
    const absoluteUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;

    if (ext === 'pdf') {
        return (
            <div className="w-full h-[800px] bg-white/5 rounded-xl overflow-hidden border border-white/10">
                <iframe src={url} className="w-full h-full" title="PDF Preview" />
            </div>
        );
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
        return (
            <div className="w-full flex justify-center bg-black/40 rounded-xl border border-white/10 p-4">
                <img src={url} alt={filename} className="max-h-[600px] object-contain rounded-lg" />
            </div>
        );
    }
    if (['mp4', 'webm', 'ogg'].includes(ext)) {
        return (
            <div className="w-full bg-black/40 rounded-xl border border-white/10 overflow-hidden">
                <video src={url} controls className="w-full" />
            </div>
        );
    }
    if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) {
        return (
            <div className="w-full h-[800px] bg-white/5 rounded-xl overflow-hidden border border-white/10 relative">
                <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(absoluteUrl)}&embedded=true`}
                    className="w-full h-full"
                    title="Office Preview"
                />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-white font-bold bg-black/80 px-4 py-2 rounded-full">External Viewer</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-64 flex flex-col items-center justify-center bg-white/5 rounded-xl border border-dashed border-white/10 text-gray-500 gap-4">
            <File size={48} className="opacity-50" />
            <div className="text-center">
                <p>Preview not available for .{ext} files.</p>
                <a href={url} target="_blank" rel="noreferrer" className="text-secondary hover:underline text-sm">Download to view</a>
            </div>
        </div>
    );
};

const NoteDetail = () => {
    const { id } = useParams();
    const [doc, setDoc] = useState<Document | null>(null);
    const [versions, setVersions] = useState<Version[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [docRes, verRes, comRes] = await Promise.all([
                    api.get(`${DOC_URL}/documents/${id}`),
                    api.get(`${VER_URL}/versions/${id}`),
                    api.get(`${COM_URL}/comments/${id}`)
                ]);
                setDoc(docRes.data);
                setVersions(verRes.data);
                setComments(comRes.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchData();
    }, [id]);

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            const res = await api.post(`${COM_URL}/comments`, {
                document_id: Number(id),
                content: newComment
            });
            setComments([...comments, res.data]);
            setNewComment('');
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (!doc) return <div>Not Found</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content: Info & Versions */}
            <div className="lg:col-span-2 space-y-8">
                {/* Home Button */}
                <div>
                    <Link to="/">
                        <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white font-mono text-sm backdrop-blur-md group mb-6">
                            <UploadIcon className="rotate-[-90deg] group-hover:-translate-x-1 transition-transform" size={18} />
                            <span>Home</span>
                        </button>
                    </Link>
                </div>

                <div>
                    <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                        {doc.title}
                    </h1>
                    <p className="text-lg text-gray-300 leading-relaxed">
                        {doc.description}
                    </p>
                    <div className="flex items-center gap-2 mt-4 text-muted text-sm">
                        <Clock size={16} />
                        Created on {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                </div>

                {/* --- File Preview Section --- */}
                {versions.length > 0 && (
                    <div className="animate-fade-in">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                            <span className="w-1.5 h-6 bg-cyan-400 rounded-full"></span>
                            Content Preview
                        </h3>
                        <FilePreview
                            url={versions[0].download_url}
                            filename={versions[0].file_name}
                        />
                    </div>
                )}

                <div className="glass-card p-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <File className="text-secondary" />
                        Version History
                    </h3>

                    <div className="space-y-3">
                        {versions.map((ver) => (
                            <div key={ver.id} className="flex items-center justify-between p-4 rounded-lg bg-black/20 hover:bg-black/30 transition-colors border border-white/5">
                                <div>
                                    <div className="font-semibold text-white">Version {ver.version_number}</div>
                                    <div className="text-xs text-muted">{new Date(ver.created_at).toLocaleString()}</div>
                                    <div className="text-xs text-muted mt-1">{ver.file_name}</div>
                                </div>
                                <a
                                    href={ver.download_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 rounded-full bg-primary/20 text-primary hover:bg-primary/40 transition-colors"
                                    title="Download"
                                >
                                    <Download size={20} />
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar: Comments */}
            <div className="lg:col-span-1">
                <div className="glass-card p-6 h-full flex flex-col">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <MessageCircle className="text-primary" />
                        Discussion
                    </h3>

                    <div className="flex-grow space-y-4 mb-6 overflow-y-auto max-h-[500px] pr-2 scrollbar-thin scrollbar-thumb-white/10">
                        {comments.length === 0 && (
                            <div className="text-center text-muted text-sm my-10">No comments yet.</div>
                        )}
                        {comments.map((comment) => (
                            <div key={comment.id} className="bg-white/5 p-3 rounded-lg border border-white/5">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-secondary text-sm">{comment.username}</span>
                                    <span className="text-[10px] text-muted">{new Date(comment.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm text-gray-300">{comment.content}</p>
                            </div>
                        ))}
                    </div>

                    <form onSubmit={handleCommentSubmit} className="mt-auto">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="w-full p-3 rounded-lg bg-black/30 border border-white/10 focus:border-primary focus:outline-none text-sm text-white resize-none mb-2"
                            placeholder="Add a comment..."
                            rows={3}
                        />
                        <button type="submit" className="w-full py-2 bg-primary/80 hover:bg-primary text-white rounded-lg text-sm font-semibold transition-colors">
                            Post Comment
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default NoteDetail;
