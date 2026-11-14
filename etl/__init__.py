"""Lost in Space ETL package.

The pipeline is:

    download -> staging (text) -> normalise -> resolve -> curate -> read models

Only ``transform`` writes canonical tables. Staging is disposable.
"""

__version__ = "0.1.0"
