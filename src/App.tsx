import React, { useState, useEffect } from 'react';
import { User } from "@supabase/supabase-js";
import { Upload, Download, Users, Search, Heart, LogIn, LogOut } from 'lucide-react';
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

let isFetchingProfile = false; // Global flag to prevent multiple fetches

function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [characterDetails, setCharacterDetails] = useState({
    name: '',
    description: '',
    image: null,
  });
  const [uploadedFile, setUploadedFile] = useState(null);

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
    if (isFetchingProfile) return; // Prevent multiple fetch calls
    isFetchingProfile = true;

    try {
      // Try to fetch the profile
      let { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

      if (error && error.code === 'PGRST116') {
        console.warn('Profile not found. Creating a new profile...');
        const defaultProfile = {
          id: user.id,
          username: user?.user_metadata?.preferred_username || user?.user_metadata?.user_name || `user-${user.id}`, // Default username
          avatar_url: null,          // Default avatar
        };

        // Use upsert to avoid conflicts
        const { error: upsertError } = await supabase
            .from('profiles')
            .upsert(defaultProfile);

        if (upsertError) {
          console.error('Error creating profile:', upsertError);
          toast.error('Failed to create profile. Please contact support.');
          return;
        }

        profile = defaultProfile;
        toast.success('Profile created successfully!');
      } else if (error) {
        console.error('Error fetching profile:', error);
        toast.error('Error fetching profile. Please try again.');
        return;
      }

      setProfile(profile);
    } catch (err) {
      console.error('Unexpected error in fetchProfile:', err);
      toast.error('An unexpected error occurred. Please try again later.');
    } finally {
      isFetchingProfile = false; // Reset the flag
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

    // If user is logged in, fetch their likes separately
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

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'application/json': ['.json'],
    },
    maxSize: 5242880, // 5MB
    multiple: false,
    disabled: isUploading,
    onDrop: async (acceptedFiles) => {
      if (!session) {
        toast.error('Please sign in to upload characters');
        return;
      }

      const file = acceptedFiles[0];
      if (!file) return;

      setIsUploading(true);
      try {
        // Parse the JSON file to extract the "name" field
        const fileContent = await file.text(); // Read file as text
        const jsonData = JSON.parse(fileContent); // Parse text as JSON

        // Validate the parsed JSON to ensure "name" exists
        if (!jsonData.name) {
          throw new Error('The uploaded JSON file must contain a "name" field.');
        }

        const characterName = jsonData.name; // Use the "name" field for the character name

        // Upload character file
        const fileExt = file.name.split('.').pop();
        const filePath = `${session.user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError, data: fileData } = await supabase.storage
            .from('character-files')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl: fileUrl } } = supabase.storage
            .from('character-files')
            .getPublicUrl(filePath);

        // Create character record
        const { error: insertError } = await supabase
            .from('characters')
            .insert({
              name: characterName, // Use the extracted "name" field
              file_url: fileUrl,
              image_url: 'https://images.unsplash.com/photo-1635236542159-0910adf9c4c4?auto=format&fit=crop&q=80&w=400', // Default image
              author_id: session.user.id,
            });

        if (insertError) throw insertError;

        toast.success('Character uploaded successfully!');
        setShowUploadModal(false);
        fetchCharacters();
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(error.message || 'Failed to upload character');
      } finally {
        setIsUploading(false);
      }
    },
  });

  return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900">
        <Toaster position="top-right" />

        {/* Header */}
        <header className="bg-black/30 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <img src="../assets/android-chrome-512x512.png"width={30} alt="ElizaTown"/>
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
                    <p className="text-purple-300">by {character.author?.username}</p>
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
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-gray-900 p-6 rounded-lg w-full max-w-md">
                <h2 className="text-xl font-bold text-white mb-4">Upload Character</h2>
                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed border-purple-500 rounded-lg p-8 text-center ${
                        isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                >
                  <input {...getInputProps()} />
                  {isUploading ? (
                      <p className="text-white">Uploading...</p>
                  ) : (
                      <p className="text-white">
                        Drag and drop a character file here, or click to select
                      </p>
                  )}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                      onClick={() => setShowUploadModal(false)}
                      className="px-4 py-2 text-white hover:bg-white/10 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}

export default App;
