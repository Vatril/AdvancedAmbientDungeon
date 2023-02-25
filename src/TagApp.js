import style from "./App.module.css"
import { Tagger } from "./components/Tagger"


export const TagApp = () => {
    return (
        <>
            <div className={style.header}>
                <h1>Ambient Dungeon</h1>
            </div>
            <div className={style.playListBox}>
                <Tagger/>
            </div>
        </>
    )
}
