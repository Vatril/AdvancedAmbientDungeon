import { gql, useMutation, useQuery } from "@apollo/client"
import { Loader } from "../util/Loader"
import style from "./Tagger.module.css"
import { useState } from "react"

const GET_SONGS = gql`
    query getSongs {
        songs {
            tags
            name
            path
        }
        genres {
            name
        }
    }
`

const ADD_TAG = gql`
    mutation add($path: String! $tag: String!) {
        addTag(songPath: $path, tag: $tag){
            tags
            name
            path
        }
    }
`

const REMOVE_TAG = gql`
    mutation remove($path: String! $tag: String!) {
        removeTag(songPath: $path, tag: $tag){
            tags
            name
            path
        }
    }
`


export const Tagger = () => {
    const { data, loading } = useQuery(GET_SONGS)
    const [add] = useMutation(ADD_TAG, {
        refetchQueries: [GET_SONGS],
    })
    const [remove] = useMutation(REMOVE_TAG, {
        refetchQueries: [GET_SONGS],
    })


    const [song, setSong] = useState(null)
    const [editTag, setEditTag] = useState("")
    const [hideTagged, setHideTagged] = useState(false)

    if (loading) {
        return <Loader />
    } else {
        return (
            <>
                <div>
                    <h2>Songs</h2>
                    <button
                        className={style.toggleButton}
                        onClick={() => setHideTagged(!hideTagged)}
                    >
                        {hideTagged?"Show Tagged": "Hide Tagged"}
                    </button>
                    <div className={style.songList}>
                        {data?.songs
                            .filter(s => s?.tags?.length === 0 || !hideTagged)
                            .map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() =>
                                        setSong(s)
                                    }
                                >
                                    {s.name.replaceAll("_", " ")}
                                    {" ("}
                                    {s?.tags?.length || "0"}
                                    {" Tags)"}
                                </button>
                            ))}
                    </div>
                </div>
                <div className={style.tagBox}>
                    <h2>Edit {song?.name}</h2>
                    {song ? <div className={style.editTag}>
                        <div>
                            <label>Enter new tag:</label>
                            <input
                                value={editTag}
                                onChange={evt => setEditTag(evt.target.value)}
                            />
                        </div>
                        <button
                            disabled={!editTag}
                            onClick={() => add({
                                variables: {
                                    path: song.path,
                                    tag: editTag.trim(),
                                },
                            }).then(res => {
                                setEditTag("")
                                setSong(res.data.addTag)
                            })}
                        >
                            Save
                        </button>
                    </div> : null}
                    <h3>Tagged with</h3>
                    {
                        data?.genres?.filter(g => song?.tags?.includes(g.name) && g.name !== "untagged")?.map(g => <div
                            key={g?.name}
                            className={style.tagList}
                        >
                            <button
                                disabled={!song}
                                onClick={() => remove({
                                    variables: {
                                        path: song.path,
                                        tag: g.name,
                                    },
                                }).then(res => {
                                    setSong(res.data.removeTag)
                                })}
                            >{g?.name}</button>
                        </div>)
                    }
                    <h3>Available Tags</h3>
                    {
                        data?.genres?.filter(g => !song?.tags?.includes(g.name) && g.name !== "untagged")?.map(g => <div
                            key={g?.name}
                            className={style.tagList}
                        >
                            <button
                                disabled={!song}
                                onClick={() => add({
                                    variables: {
                                        path: song.path,
                                        tag: g.name,
                                    },
                                }).then(res => {
                                    setSong(res.data.addTag)
                                })}
                            >{g?.name}</button>
                        </div>)
                    }
                </div>
            </>
        )
    }
}
