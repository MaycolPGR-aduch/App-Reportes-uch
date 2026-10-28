"""Diagnóstico manual de evidencias. No altera la base ni el almacenamiento."""
import argparse

from app.db.session import SessionLocal
from app.services.evidence_inventory import inventory
from app.services.storage import get_storage_provider


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--grace-hours", type=int, default=24)
    parser.add_argument("--show-paths", action="store_true",
                        help="Muestra rutas sensibles: no compartir la salida públicamente")
    args = parser.parse_args()
    with SessionLocal() as db:
        result = inventory(db, get_storage_provider(), grace_hours=args.grace_hours)
    print(f"Posibles huérfanos: {len(result.orphan_candidates)}")
    print(f"Posibles archivos faltantes: {len(result.missing_candidates)}")
    print("Solo diagnóstico; verificar nuevamente antes de cualquier intervención.")
    if args.show_paths:
        for name, paths in (("HUÉRFANO", result.orphan_candidates),
                            ("FALTANTE", result.missing_candidates)):
            for path in paths:
                print(f"{name}: {path}")


if __name__ == "__main__":
    main()
