import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { DOC_URL, VER_URL } from '../services/api';
import { Upload as UploadIcon, File } from 'lucide-react';

const Upload = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [documents, setDocuments] = useState<any[]>([]); // simple type for now
    const navigate = useNavigate();

    // Fetch existing notes similar to Dashboard
    useEffect(() => {
        const fetchDocuments = async () => {
            try {
                const res = await api.get(`${DOC_URL}/documents`);
                setDocuments(res.data);
            } catch (err) {
                console.error("Failed to fetch documents", err);
            }
        };
        fetchDocuments();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setLoading(true);
        try {
            // 1. Create Document
            const docRes = await api.post(`${DOC_URL}/documents`, {
                title,
                description,
                tags: (() => {
                    if (!file) return 'GENERAL';
                    const name = file.name.toLowerCase();
                    if (name.endsWith('.pdf')) return 'PDF';
                    if (name.match(/\.(doc|docx)$/)) return 'DOC';
                    if (name.match(/\.(ppt|pptx)$/)) return 'PPT';
                    if (name.match(/\.(xls|xlsx)$/)) return 'XLS';
                    if (name.match(/\.(txt|md|rtf)$/)) return 'TXT';
                    if (name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'IMG';
                    if (name.match(/\.(zip|rar|7z|tar|gz)$/)) return 'ARCHIVE';
                    if (name.match(/\.(js|ts|jsx|tsx|py|html|css|json|java|cpp|c|cs|go|rs|php)$/)) return 'CODE';
                    return 'FILE';
                })()
            });
            const docId = docRes.data.id;

            // 2. Upload Version 
            const formData = new FormData();
            formData.append('file', file);

            await api.post(`${VER_URL}/versions?document_id=${docId}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            navigate(`/note/${docId}`);
        } catch (err) {
            console.error(err);
            alert("Upload failed. Check console.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen p-6 sm:p-12 max-w-7xl mx-auto flex flex-col gap-8">
            {/* Header / Home Button */}
            <div className="flex items-center">
                <Link to="/">
                    <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white font-mono text-sm backdrop-blur-md group">
                        <UploadIcon className="rotate-[-90deg] group-hover:-translate-x-1 transition-transform" size={18} />
                        <span>Home</span>
                    </button>
                </Link>
            </div>

            <div className="flex flex-col lg:flex-row gap-10 items-start">
                {/* Main Upload Form */}
                <div className="w-full lg:flex-1">
                    <h1 className="text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Upload New Note</h1>

                    <div className="glass-card p-8 bg-black/40 border border-white/10 rounded-3xl backdrop-blur-xl">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div>
                                <label className="block text-sm text-cyan-300/80 mb-3 font-mono uppercase tracking-wider">Node Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-6 py-4 rounded-xl bg-black/50 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all text-white placeholder-white/20"
                                    required
                                    placeholder="e.g. Advanced Calculus Week 1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-cyan-300/80 mb-3 font-mono uppercase tracking-wider">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-6 py-4 rounded-xl bg-black/50 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all text-white h-32 resize-none placeholder-white/20"
                                    placeholder="Briefly describe the contents..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-cyan-300/80 mb-3 font-mono uppercase tracking-wider">Data File</label>
                                <div className="border-2 border-dashed border-white/10 rounded-2xl p-10 text-center hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all cursor-pointer relative group">
                                    <input
                                        type="file"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        required
                                    />
                                    <div className="flex flex-col items-center gap-4 pointer-events-none">
                                        {file ? (
                                            <>
                                                <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                                                    <File size={32} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold text-lg">{file.name}</span>
                                                    <span className="text-sm text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-cyan-400 group-hover:scale-110 transition-all">
                                                    <UploadIcon size={32} />
                                                </div>
                                                <span className="text-gray-400 group-hover:text-gray-300 transition-colors">Click or drag file here</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !file}
                                className="w-full py-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-lg tracking-wide shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-[0.99]"
                            >
                                {loading ? 'Uploading...' : 'Initialize Node'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Sidebar / Notes List */}
                <div className="w-full lg:w-96 flex flex-col gap-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                        <span className="w-2 h-8 bg-purple-500 rounded-full"></span>
                        Recent Nodes
                    </h2>

                    <div className="flex flex-col gap-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                        {documents.length === 0 ? (
                            <div className="p-8 rounded-2xl bg-white/5 border border-white/5 text-center text-gray-500 italic">
                                No nodes initialized yet.
                            </div>
                        ) : (
                            documents.map((doc: any) => (
                                <Link to={`/note/${doc.id}`} key={doc.id}>
                                    <div className="p-5 rounded-2xl bg-black/40 border border-white/5 hover:border-purple-500/50 hover:bg-white/5 transition-all group">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-gray-200 group-hover:text-purple-300 transition-colors line-clamp-1">{doc.title}</h4>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 line-clamp-2">{doc.description || "No description."}</p>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Upload;
