/*
  # Initial Schema Setup for ElizaTown

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key) - matches auth.users id
      - `username` (text, unique)
      - `avatar_url` (text)
      - `created_at` (timestamp)
    
    - `characters`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `file_url` (text)
      - `image_url` (text)
      - `author_id` (uuid, foreign key)
      - `download_count` (integer)
      - `created_at` (timestamp)
    
    - `likes`
      - `character_id` (uuid)
      - `user_id` (uuid)
      - Primary key is (character_id, user_id)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  username text UNIQUE NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Create characters table
CREATE TABLE characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  file_url text NOT NULL,
  image_url text NOT NULL,
  author_id uuid REFERENCES profiles(id) NOT NULL,
  download_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Characters are viewable by everyone"
  ON characters
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own characters"
  ON characters
  FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own characters"
  ON characters
  FOR UPDATE
  USING (auth.uid() = author_id);

-- Create likes table
CREATE TABLE likes (
  character_id uuid REFERENCES characters(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (character_id, user_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all likes"
  ON likes
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own likes"
  ON likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
  ON likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to get character likes count
CREATE OR REPLACE FUNCTION get_character_likes_count(character_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM likes
    WHERE likes.character_id = $1
  );
END;
$$;