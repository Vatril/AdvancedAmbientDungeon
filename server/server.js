const {
    ApolloServerPluginLandingPageLocalDefault,
} = require("apollo-server-core")
const { ApolloServer, gql } = require("apollo-server")
const { client, player, currentChannel } = require("../bot/bot")
const { createAudioResource, AudioPlayerStatus } = require("@discordjs/voice")
const { readdirSync, readFileSync } = require("fs")
const path = require("path")
const { Database } = require("sqlite3")


const settingData = readFileSync("settings.json", "utf8")
const jsonSettingData = JSON.parse(settingData)

const UNTAGGED = "untagged"


const folderList = []
const allMusic = []
const specialList = []
const genres = {
    [UNTAGGED]: [],
}
const songs_map = {}
let genre = ""
let songName = ""

const db = new Database("./ambient_dungeon.db", (err) => {
    if (err) {
        console.error(err.message)
    }
    console.info("Initialized Db")
})


const scanFolders = (scanFolder, rootPath) => {
    const folders = readdirSync(scanFolder, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
    folderList.push(...(rootPath ? folders.map(f => path.join(rootPath, f)) : folders))
    for (const folder of folders) {
        scanFolders(path.join(scanFolder, folder), rootPath ? path.join(rootPath, folder) : folder)
    }
}

scanFolders(jsonSettingData["musicFolder"])

for (const folder of folderList) {
    if (path.join(jsonSettingData["musicFolder"], genre) === jsonSettingData["specialFolder"]) {
        continue
    }
    readdirSync(path.join(jsonSettingData["musicFolder"], folder), { withFileTypes: true })
        .filter(dirent => !dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(dirent => jsonSettingData["formats"].some(e => dirent.toLowerCase().endsWith(e)))
        .forEach(s => allMusic.push(path.join(folder, s)))
}

const stmt = db.prepare("INSERT or IGNORE INTO songs (song_path) VALUES (?)")
for (const song of allMusic) {
    stmt.run(song)
}
stmt.finalize()

for (const song of allMusic) {
    db.all(`
SELECT song_path, tag_name
FROM songs s
JOIN tags t on s.song_id = t.song_id
WHERE song_path = ?;
    `, [song], (_, rows) => {
        if (rows.length) {
            for (const row of rows) {
                if (genres[row["tag_name"]]) {
                    genres[row["tag_name"]].push(song)
                } else {
                    genres[row["tag_name"]] = [song]
                }
            }
        } else {
            genres[UNTAGGED].push(song)
        }
    })
}

const buildSongsMap = () => {
    for (const song of Object.keys(songs_map)) {
        songs_map[song] = []
    }
    for (const [tag, songs] of Object.entries(genres)) {
        for (song of songs) {
            if (tag !== UNTAGGED) {
                if (songs_map[song]) {
                    songs_map[song].push(tag)
                } else {
                    songs_map[song] = [tag]
                }
            } else {
                if (!songs_map[song]) {
                    songs_map[song] = []
                }
            }
        }
    }
}


readdirSync(jsonSettingData["specialFolder"], { withFileTypes: true })
    .filter(dirent => !dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(dirent => jsonSettingData["formats"].some(e => dirent.toLowerCase().endsWith(e)))
    .forEach(s => specialList.push(s))

console.log(`Scanning folder ${jsonSettingData["musicFolder"]}`)
console.log(`Found:`)
console.table(Object.entries(genres).map(g => ({
    "name": g[0],
    "amount": g[1].length,
})))
console.log(`Specials:`)
console.table(specialList)


const typeDefs = gql`

  type Genre {
    name: String!
    amount: Int!
  }
  
  type Status {
    channel: String
    genre: String
    song: String
    isPlaying: Boolean
  }
  
  type Song {
    name: String
    path: String
    tags: [String]
  }

  type Query {
    genres: [Genre]
    songs: [Song]
    specials: [String]
    status: Status
  }

  type Mutation {
    play(genre: String!): Boolean
    playSpecial(song: String!): Boolean
    pause: Boolean
    unpause: Boolean
    skip: Boolean
    addTag(songPath: String! tag: String!): Song
    removeTag(songPath: String! tag: String!): Song
  }
`


player.on(AudioPlayerStatus.Idle, () => {
    playRandom()
})

const playRandom = () => {
    if (genre) {

        let position = -1

        while (true) {
            position = Math.floor(Math.random() * genres[genre].length)
            if (genres[genre][position] !== songName || genres[genre].length < 2) {
                break
            }
        }
        songName = genres[genre][position]

        client.user.setPresence({ status: "online", activities: [{ name: songName, type: 2 }] })

        player.play(createAudioResource(path.join(jsonSettingData["musicFolder"], songName), {
            metadata: {
                title: songName,
            },
        }))
        return true
    } else {
        client.user.setPresence({ status: "online", activities: [{ name: "the waiting game", type: 0 }] })
        songName = null
        return false
    }
}

const playSong = (song) => {
    if (song) {

        songName = song
        genre = null

        client.user.setPresence({ status: "online", activities: [{ name: songName, type: 2 }] })

        player.play(createAudioResource(path.join(jsonSettingData["specialFolder"], songName), {
            metadata: {
                title: songName,
            },
        }))
        return true
    } else {
        client.user.setPresence({ status: "online", activities: [{ name: "the waiting game", type: 0 }] })
        songName = null
        return false
    }
}


const resolvers = {
    Mutation: {
        play: (parent, args) => {
            genre = args.genre
            return playRandom()
        },
        playSpecial: (parent, args) => {
            return playSong(args.song)
        },
        pause: () => {
            player.pause()
            return true
        },
        unpause: () => {
            player.unpause()
            return true
        },
        skip: () => {
            return playRandom()
        },
        addTag: (parent, args) => {
            const {
                songPath,
                tag,
            } = args

            const cleanTag = tag.toLowerCase().trim()

            if (genres[cleanTag]) {
                genres[cleanTag].push(songPath)
            } else {
                genres[cleanTag] = [songPath]
            }

            buildSongsMap()

            db.run(`
INSERT or IGNORE INTO tags (song_id, tag_name)
SELECT song_id, ? FROM songs
        WHERE song_path = ?
            `, [cleanTag, songPath])

            return {
                path: songPath,
                name: songPath.split(path.sep).pop(),
                tags: songs_map[songPath],
            }
        },
        removeTag: (parent, args) => {
            const {
                songPath,
                tag,
            } = args

            const cleanTag = tag.toLowerCase().trim()

            genres[cleanTag] = genres[cleanTag].filter(s => s !== songPath)

            buildSongsMap()

            db.run(`
DELETE FROM tags
WHERE tag_name = ? AND song_id = (
    SELECT song_id from songs WHERE song_path = ?
    )
            `, [cleanTag, songPath])

            return {
                path: songPath,
                name: songPath.split(path.sep).pop(),
                tags: songs_map[songPath],
            }
        },
    },
    Query: {
        genres: () => {
            const genreList = Object.entries(genres).map(g => ({
                "amount": g[1].length,
                "name": g[0],
            }))

            genreList.sort((a, b) => {
                return a.name > b.name ? 1: -1
            })

            return genreList
        },
        specials: () => specialList,
        status: () => ({
            channel: currentChannel?.name,
            genre,
            song: songName.split(path.sep).pop(),
            isPlaying: player.state.status === AudioPlayerStatus.Playing,
        }),
        songs: () => {
            buildSongsMap()
            const songs = Object.entries(songs_map).map(s => ({
                path: s[0],
                name: s[0].split(path.sep).pop(),
                tags: s[1],
            }))
            songs.sort((a, b) => {
                return a.path > b.path ? 1: -1
            })
            return songs
        },
    },
}


const server = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: true,
    cache: "bounded",

    plugins: [
        ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],

})

server.listen().then(() => {
    client.login(jsonSettingData["token"])
    console.log(`Server started`)
})