import React, { useState, useEffect } from 'react';
import { User } from "@supabase/supabase-js";
import { Upload, Download, Search, Heart, LogIn, LogOut } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Toaster, toast } from 'react-hot-toast';
import { supabase } from './lib/supabase';

interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
}

interface Character {
  id: string;
  name: string;
  description?: string;
  file_url: string;
  image_url: string;
  author_id: string;
  download_count: number;
  created_at: string;
  author?: Profile;
  likes_count?: number;
  is_liked?: boolean;
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

let isFetchingProfile = false;

const UploadModal = ({ isOpen, onClose }: UploadModalProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [characterFile, setCharacterFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [details, setDetails] = useState({
    name: '',
    description: ''
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  const { getRootProps: getCharacterProps, getInputProps: getCharacterInputProps } = useDropzone({
    accept: { 'application/json': ['.json'] },
    maxSize: 5242880,
    multiple: false,
    onDrop: async (files) => {
      const file = files[0];
      if (!file) return;

      try {
        const content = await file.text();
        const json = JSON.parse(content);
        setDetails(prev => ({ ...prev, name: json.name || '' }));
        setCharacterFile(file);
      } catch (error) {
        toast.error('Invalid JSON file');
      }
    }
  });

  const { getRootProps: getImageProps, getInputProps: getImageInputProps } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxSize: 5242880,
    multiple: false,
    onDrop: (files) => {
      const file = files[0];
      if (!file) return;
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  });

  const handleUpload = async () => {
    if (!characterFile || !imageFile || !session) {
      toast.error('Please provide all required files');
      return;
    }

    setIsUploading(true);
    try {
      // Upload image
      const imageExt = imageFile.name.split('.').pop();
      const imagePath = `${session.user.id}/${Date.now()}.${imageExt}`;
      const { error: imageError } = await supabase.storage
          .from('character-images')
          .upload(imagePath, imageFile);
      if (imageError) throw imageError;

      const { data: { publicUrl: imageUrl } } = supabase.storage
          .from('character-images')
          .getPublicUrl(imagePath);

      // Upload character file
      const fileExt = characterFile.name.split('.').pop();
      const filePath = `${session.user.id}/${Date.now()}.${fileExt}`;
      const { error: fileError } = await supabase.storage
          .from('character-files')
          .upload(filePath, characterFile);
      if (fileError) throw fileError;

      const { data: { publicUrl: fileUrl } } = supabase.storage
          .from('character-files')
          .getPublicUrl(filePath);

      // Create character record
      const { error: insertError } = await supabase
          .from('characters')
          .insert({
            name: details.name,
            description: details.description,
            file_url: fileUrl,
            image_url: imageUrl,
            author_id: session.user.id,
          });

      if (insertError) throw insertError;

      toast.success('Character uploaded successfully!');
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload character');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gray-900 p-6 rounded-lg w-full max-w-md">
          <h2 className="text-xl font-bold text-white mb-4">Upload Character</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Character File</label>
              <div {...getCharacterProps()} className="border-2 border-dashed border-purple-500 rounded-lg p-4 text-center cursor-pointer">
                <input {...getCharacterInputProps()} />
                <p className="text-white">{characterFile ? characterFile.name : 'Drop character file here'}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Character Image</label>
              <div {...getImageProps()} className="border-2 border-dashed border-purple-500 rounded-lg p-4 text-center cursor-pointer">
                <input {...getImageInputProps()} />
                {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="mx-auto max-h-32 object-contain" />
                ) : (
                    <p className="text-white">Drop character image here</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Name</label>
              <input
                  type="text"
                  value={details.name}
                  onChange={(e) => setDetails(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Description</label>
              <textarea
                  value={details.description}
                  onChange={(e) => setDetails(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white"
                  rows={3}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
                onClick={onClose}
                className="px-4 py-2 text-white hover:bg-white/10 rounded-lg transition"
            >
              Cancel
            </button>
            <button
                onClick={handleUpload}
                disabled={isUploading || !characterFile || !imageFile}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
  );
};

function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchCharacters();
  }, [searchQuery, session]);

  const fetchProfile = async (user: User) => {
    if (isFetchingProfile) return;
    isFetchingProfile = true;

    try {
      let { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

      if (error && error.code === 'PGRST116') {
        const defaultProfile = {
          id: user.id,
          username: user?.user_metadata?.preferred_username || user?.user_metadata?.user_name || `user-${user.id}`,
          avatar_url: null,
        };

        const { error: upsertError } = await supabase
            .from('profiles')
            .upsert(defaultProfile);

        if (upsertError) {
          console.error('Error creating profile:', upsertError);
          toast.error('Failed to create profile');
          return;
        }

        profile = defaultProfile;
        toast.success('Profile created successfully!');
      } else if (error) {
        console.error('Error fetching profile:', error);
        toast.error('Error fetching profile');
        return;
      }

      setProfile(profile);
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      isFetchingProfile = false;
    }
  };

  const fetchCharacters = async () => {
    let query = supabase
        .from('characters')
        .select(`
        *,
        author:profiles!characters_author_id_fkey(username, avatar_url),
        likes:likes(count)
      `)
        .order('created_at', { ascending: false });

    if (searchQuery) {
      query = query.ilike('name', `%${searchQuery}%`);
    }

    const { data: charactersData, error: charactersError } = await query;

    if (charactersError) {
      toast.error('Failed to load characters');
      return;
    }

    let userLikes: Record<string, boolean> = {};
    if (session?.user) {
      const { data: likesData } = await supabase
          .from('likes')
          .select('character_id')
          .eq('user_id', session.user.id);

      userLikes = (likesData || []).reduce((acc: Record<string, boolean>, like) => {
        acc[like.character_id] = true;
        return acc;
      }, {});
    }

    const processedData = charactersData?.map(char => ({
      ...char,
      likes_count: char.likes?.[0]?.count || 0,
      is_liked: userLikes[char.id] || false
    }));

    setCharacters(processedData || []);
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github'
    });

    if (error) {
      toast.error('Failed to sign in');
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Failed to sign out');
    }
  };

  const handleLike = async (characterId: string, isLiked: boolean) => {
    if (!session) {
      toast.error('Please sign in to like characters');
      return;
    }

    if (isLiked) {
      const { error } = await supabase
          .from('likes')
          .delete()
          .match({ character_id: characterId, user_id: session.user.id });

      if (error) {
        toast.error('Failed to unlike character');
        return;
      }
    } else {
      const { error } = await supabase
          .from('likes')
          .insert({ character_id: characterId, user_id: session.user.id });

      if (error) {
        toast.error('Failed to like character');
        return;
      }
    }

    fetchCharacters();
  };

  const handleDownload = async (character: Character) => {
    window.open(character.file_url, '_blank');

    const { error } = await supabase
        .from('characters')
        .update({ download_count: character.download_count + 1 })
        .eq('id', character.id);

    if (error) {
      console.error('Failed to update download count:', error);
    } else {
      fetchCharacters();
    }
  };

  return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900">
        <Toaster position="top-right" />

        {/* Header */}
        <header className="bg-black/30 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <img src="./assets/android-chrome-512x512.png" width={30} alt="ElizaTown"/>
                <h1 className="text-2xl font-bold text-white">ElizaTown</h1>
              </div>
              <div className="flex items-center space-x-4">
                {session ? (
                    <>
                      <button
                          onClick={() => setShowUploadModal(true)}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center space-x-2 transition"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Upload Character</span>
                      </button>
                      <button
                          onClick={handleLogout}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center space-x-2 transition"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </>
                ) : (
                    <button
                        onClick={handleLogin}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center space-x-2 transition"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Sign In</span>
                    </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Search */}
        <div className="container mx-auto px-4 py-8">
          <div className="relative">
            <input
                type="text"
                placeholder="Search characters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-12 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
          </div>
        </div>

        {/* Character Grid */}
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map((character) => (
                <div key={character.id} className="bg-white/10 rounded-lg overflow-hidden border border-white/10 hover:border-purple-500 transition group">
                  <div className="relative aspect-video">
                    <img
                        src={character.image_url}
                        alt={character.name}
                        className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-xl font-semibold text-white">{character.name}</h3>
                    {character.description && (
                        <p className="text-white/70 mt-1">{character.description}</p>
                    )}
                    <p className="text-purple-300 mt-2">by {character.author?.username}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <button
                            onClick={() => handleLike(character.id, character.is_liked || false)}
                            className={`flex items-center space-x-1 ${
                                character.is_liked ? 'text-pink-500' : 'text-white/70'
                            } hover:text-pink-500 transition`}
                        >
                          <Heart className="w-4 h-4" fill={character.is_liked ? 'currentColor' : 'none'} />
                          <span>{character.likes_count}</span>
                        </button>
                        <button
                            onClick={() => handleDownload(character)}
                            className="flex items-center space-x-1 text-white/70 hover:text-white transition"
                        >
                          <Download className="w-4 h-4" />
                          <span>{character.download_count}</span>
                        </button>
                      </div>
                      <span className="text-white/50 text-sm">
                    {new Date(character.created_at).toLocaleDateString()}
                  </span>
                    </div>
                  </div>
                </div>
            ))}
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
            <UploadModal
                isOpen={showUploadModal}
                onClose={() => {
                  setShowUploadModal(false);
                  fetchCharacters();
                }}
            />
        )}
      </div>
);
}

export default App;